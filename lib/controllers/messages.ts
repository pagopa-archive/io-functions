/*
 * Implements the API handlers for the Message resource.
 */

import * as express from "express";
import * as winston from "winston";

import * as ApplicationInsights from "applicationinsights";

import { IContext } from "azure-function-express";

import { left, right } from "../utils/either";

import { CreatedMessage } from "../api/definitions/CreatedMessage";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { MessageResponse } from "../api/definitions/MessageResponse";
import { isNewMessage, NewMessage } from "../api/definitions/NewMessage";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";
import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../utils/middlewares/azure_user_attributes";
import { ContextMiddleware } from "../utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "../utils/middlewares/fiscalcode";
import { RequiredIdParamMiddleware } from "../utils/middlewares/required_id_param";
import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  IResponseErrorForbiddenNotAuthorizedForProduction,
  IResponseErrorForbiddenNotAuthorizedForRecipient,
  IResponseErrorNotFound,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessJsonIterator,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  ResponseErrorForbiddenNotAuthorizedForProduction,
  ResponseErrorForbiddenNotAuthorizedForRecipient,
  ResponseErrorNotFound,
  ResponseErrorQuery,
  ResponseErrorValidation,
  ResponseSuccessJson,
  ResponseSuccessJsonIterator,
  ResponseSuccessRedirectToResource
} from "../utils/response";
import { ObjectIdGenerator, ulidGenerator } from "../utils/strings";

import { mapResultIterator } from "../utils/documentdb";

import { ICreatedMessageEvent } from "../models/created_message_event";

import { NotificationModel } from "../models/notification";
import { ServiceModel } from "../models/service";

import {
  IMessage,
  IMessageContent,
  INewMessageWithoutContent,
  IRetrievedMessage,
  MessageModel
} from "../models/message";

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IBindings {
  // tslint:disable-next-line:readonly-keyword
  createdMessage?: ICreatedMessageEvent;
}

/**
 * A request middleware that validates the Message payload.
 */
export const MessagePayloadMiddleware: IRequestMiddleware<
  IResponseErrorValidation,
  NewMessage
> = request => {
  const requestBody = request.body;

  if (isNewMessage(requestBody)) {
    return Promise.resolve(right(requestBody));
  } else {
    return Promise.resolve(
      left(
        ResponseErrorValidation(
          "Request not valid",
          "The request payload does not represent a valid NewMessage"
        )
      )
    );
  }
};

/**
 * Converts a retrieved message to a message that can be shared via API
 */
function retrievedMessageToPublic(
  retrievedMessage: IRetrievedMessage
): CreatedMessage {
  return {
    fiscal_code: retrievedMessage.fiscalCode,
    id: retrievedMessage.id,
    sender_service_id: retrievedMessage.senderServiceId
  };
}

/**
 * Type of a CreateMessage handler.
 *
 * CreateMessage expects an Azure Function Context and FiscalCode as input
 * and returns the created Message as output.
 * The Context is needed to output the created Message to a queue for
 * further processing.
 */
type ICreateMessageHandler = (
  context: IContext<IBindings>,
  auth: IAzureApiAuthorization,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  messagePayload: NewMessage
) => Promise<
  | IResponseSuccessRedirectToResource<IMessage, {}>
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenNotAuthorizedForRecipient
  | IResponseErrorForbiddenNotAuthorizedForProduction
  | IResponseErrorForbiddenNotAuthorizedForDefaultAddresses
>;

/**
 * Type of a GetMessage handler.
 *
 * GetMessage expects a FiscalCode and a Message ID as input
 * and returns a Message as output or a Not Found or Validation
 * errors.
 */
type IGetMessageHandler = (
  auth: IAzureApiAuthorization,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  messageId: string
) => Promise<
  | IResponseSuccessJson<MessageResponse>
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
>;

/**
 * Type of a GetMessages handler.
 *
 * GetMessages expects a FiscalCode as input and returns the Messages
 * as output or a Validation error.
 *
 * TODO: add full results and paging
 */
type IGetMessagesHandler = (
  auth: IAzureApiAuthorization,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJsonIterator<CreatedMessage>
  | IResponseErrorValidation
  | IResponseErrorQuery
>;

/**
 * Returns a type safe CreateMessage handler.
 */
export function CreateMessageHandler(
  applicationInsightsClient: ApplicationInsights.TelemetryClient,
  messageModel: MessageModel,
  generateObjectId: ObjectIdGenerator
): ICreateMessageHandler {
  return async (context, auth, userAttributes, fiscalCode, messagePayload) => {
    // extract the user service
    const userService = userAttributes.service;

    // base appinsights event attributes for convenience (used later)
    const appInsightsEventName = "api.messages.create";
    const appInsightsEventProps = {
      hasCustomSubject: Boolean(messagePayload.content.subject).toString(),
      hasDefaultEmail: Boolean(
        messagePayload.default_addresses &&
          messagePayload.default_addresses.email
      ).toString(),
      senderServiceId: userService.serviceId,
      senderUserId: auth.userId
    };

    //
    // authorization checks
    //

    // check whether the user is authorized to send messages to limited recipients
    // or whether the user is authorized to send messages to any recipient
    if (auth.groups.has(UserGroup.ApiLimitedMessageWrite)) {
      // user is in limited message creation mode, check whether he's sending
      // the message to an authorized recipient
      if (
        !userAttributes.service.authorizedRecipients ||
        userAttributes.service.authorizedRecipients.indexOf(fiscalCode) === -1
      ) {
        return ResponseErrorForbiddenNotAuthorizedForRecipient;
      }
    } else if (!auth.groups.has(UserGroup.ApiMessageWrite)) {
      // the user is doing a production call but he's not enabled
      return ResponseErrorForbiddenNotAuthorizedForProduction;
    }

    // check whether the user is authorized to provide default addresses
    if (
      messagePayload.default_addresses &&
      !auth.groups.has(UserGroup.ApiMessageWriteDefaultAddress)
    ) {
      // the user is sending a message by providing default addresses but he's
      // not allowed to do so.
      return ResponseErrorForbiddenNotAuthorizedForDefaultAddresses;
    }

    // create a new message from the payload
    // this object contains only the message metadata, the content of the
    // message is handled separately (see below)
    const newMessageWithoutContent: INewMessageWithoutContent = {
      fiscalCode,
      id: generateObjectId(),
      kind: "INewMessageWithoutContent",
      senderServiceId: userService.serviceId,
      senderUserId: auth.userId
    };

    //
    // handle real message creation requests
    //

    // attempt to create the message
    const errorOrMessage = await messageModel.create(
      newMessageWithoutContent,
      newMessageWithoutContent.fiscalCode
    );

    if (errorOrMessage.isLeft) {
      // we got an error while creating the message

      // track the event that a message has failed to be created
      applicationInsightsClient.trackEvent({
        name: appInsightsEventName,
        properties: {
          ...appInsightsEventProps,
          error: "IResponseErrorQuery",
          success: "false"
        }
      });

      winston.debug(
        `CreateMessageHandler|error|${JSON.stringify(errorOrMessage.left)}`
      );

      // return an error response
      return ResponseErrorQuery(
        "Error while creating Message",
        errorOrMessage.left
      );
    }

    // message creation succeeded
    const retrievedMessage = errorOrMessage.right;

    winston.debug(
      `CreateMessageHandler|message created|${userService.serviceId}|${retrievedMessage.id}`
    );

    //
    // emit created message event to the output queue
    //

    const messageContent: IMessageContent = {
      bodyMarkdown: messagePayload.content.markdown,
      subject: messagePayload.content.subject
    };

    // prepare the created message event
    const createdMessageEvent: ICreatedMessageEvent = {
      defaultAddresses: messagePayload.default_addresses,
      message: newMessageWithoutContent,
      messageContent,
      senderMetadata: {
        departmentName: userAttributes.service.departmentName,
        organizationName: userAttributes.service.organizationName,
        serviceName: userAttributes.service.serviceName
      }
    };

    // queue the message to the created messages queue by setting
    // the message to the output binding of this function
    // tslint:disable-next-line:no-object-mutation
    context.bindings.createdMessage = createdMessageEvent;

    //
    // generate appinsights event
    //

    // track the event that a message has been created
    applicationInsightsClient.trackEvent({
      name: appInsightsEventName,
      properties: {
        ...appInsightsEventProps,
        success: "true"
      }
    });

    //
    // respond to request
    //

    // redirect the client to the message resource
    return ResponseSuccessRedirectToResource(
      newMessageWithoutContent,
      `/api/v1/messages/${fiscalCode}/${newMessageWithoutContent.id}`,
      {}
    );
  };
}

/**
 * Wraps a CreateMessage handler inside an Express request handler.
 */
export function CreateMessage(
  applicationInsightsClient: ApplicationInsights.TelemetryClient,
  serviceModel: ServiceModel,
  messageModel: MessageModel
): express.RequestHandler {
  const handler = CreateMessageHandler(
    applicationInsightsClient,
    messageModel,
    ulidGenerator
  );
  const middlewaresWrap = withRequestMiddlewares(
    // extract Azure Functions bindings
    ContextMiddleware<IBindings>(),
    // allow only users in the ApiMessageWrite and ApiMessageWriteLimited groups
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageWrite, UserGroup.ApiLimitedMessageWrite])
    ),
    // extracts custom user attributes from the request
    AzureUserAttributesMiddleware(serviceModel),
    // extracts the fiscal code from the request params
    FiscalCodeMiddleware,
    // extracts the create message payload from the request body
    MessagePayloadMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting a single message for a recipient.
 */
export function GetMessageHandler(
  messageModel: MessageModel,
  notificationModel: NotificationModel
): IGetMessageHandler {
  return async (userAuth, userAttributes, fiscalCode, messageId) => {
    // whether the user is a trusted application (i.e. can access all messages for a user)
    const canListMessages = userAuth.groups.has(UserGroup.ApiMessageList);
    if (!canListMessages) {
      // since this is not a trusted application we must allow only accessing messages
      // that have been sent by the service he belongs to
      if (!userAttributes.service) {
        // the user doesn't have any service associated, so we can't continue
        return ResponseErrorForbiddenNotAuthorized;
      }
    }

    const errorOrMaybeDocument = await messageModel.findMessageForRecipient(
      fiscalCode,
      messageId
    );

    if (errorOrMaybeDocument.isLeft) {
      // the query failed
      return ResponseErrorQuery(
        "Error while retrieving the message",
        errorOrMaybeDocument.left
      );
    }

    const maybeDocument = errorOrMaybeDocument.right;
    if (maybeDocument.isEmpty) {
      // the document does not exist
      return ResponseErrorNotFound(
        "Message not found",
        "The message that you requested was not found in the system."
      );
    }

    const retrievedMessage = maybeDocument.get;

    // the user is allowed to see the message when he is either
    // a trusted application or he is the sender of the message
    const isUserAllowed =
      canListMessages ||
      (userAttributes.service &&
        retrievedMessage.senderServiceId === userAttributes.service.serviceId);

    if (!isUserAllowed) {
      // the user is not allowed to see the message
      return ResponseErrorForbiddenNotAuthorized;
    }

    const errorOrMaybeNotification = await notificationModel.findNotificationForMessage(
      retrievedMessage.id
    );

    if (errorOrMaybeNotification.isLeft) {
      // query failed
      return ResponseErrorQuery(
        "Error while retrieving the notification status",
        errorOrMaybeNotification.left
      );
    }

    const maybeNotification = errorOrMaybeNotification.right;

    const maybeNotificationStatus = maybeNotification.map(n => {
      return {
        email: n.emailNotification ? n.emailNotification.status : undefined
      };
    });

    const messageStatus: MessageResponse = {
      message: retrievedMessageToPublic(retrievedMessage),
      notification: maybeNotificationStatus.isDefined
        ? maybeNotificationStatus.get
        : undefined
    };

    return ResponseSuccessJson(messageStatus);
  };
}

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
export function GetMessage(
  serviceModel: ServiceModel,
  messageModel: MessageModel,
  notificationModel: NotificationModel
): express.RequestHandler {
  const handler = GetMessageHandler(messageModel, notificationModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList])
    ),
    AzureUserAttributesMiddleware(serviceModel),
    FiscalCodeMiddleware,
    RequiredIdParamMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(
  messageModel: MessageModel
): IGetMessagesHandler {
  return async (_, fiscalCode) => {
    const retrievedMessagesIterator = await messageModel.findMessages(
      fiscalCode
    );
    const publicExtendedMessagesIterator = mapResultIterator(
      retrievedMessagesIterator,
      retrievedMessageToPublic
    );
    return ResponseSuccessJsonIterator(publicExtendedMessagesIterator);
  };
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiMessageList])),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
