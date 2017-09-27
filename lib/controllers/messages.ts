/*
 * Implements the API handlers for the Message resource.
 */

import * as express from "express";
import * as ulid from "ulid";

import * as ApplicationInsights from "applicationinsights";

import { IContext } from "azure-function-express";

import { left, right } from "../utils/either";

import { CreatedMessage } from "../api/definitions/CreatedMessage";
import { CreatedMessageResponse } from "../api/definitions/CreatedMessageResponse";
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
  IResponseErrorForbiddenNotAuthorizedForDryRun,
  IResponseErrorForbiddenNotAuthorizedForProduction,
  IResponseErrorNotFound,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessJsonIterator,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  ResponseErrorForbiddenNotAuthorizedForDryRun,
  ResponseErrorForbiddenNotAuthorizedForProduction,
  ResponseErrorNotFound,
  ResponseErrorQuery,
  ResponseErrorValidation,
  ResponseSuccessJson,
  ResponseSuccessJsonIterator,
  ResponseSuccessRedirectToResource
} from "../utils/response";
import { toNonEmptyString } from "../utils/strings";

import { mapResultIterator } from "../utils/documentdb";

import { ICreatedMessageEvent } from "../models/created_message_event";

import { NotificationModel } from "../models/notification";
import { OrganizationModel } from "../models/organization";

import {
  IMessage,
  IMessageContent,
  INewMessageWithoutContent,
  IRetrievedMessage,
  IRetrievedMessageWithoutContent,
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
    sender_organization_id: retrievedMessage.senderOrganizationId
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
  | IResponseSuccessRedirectToResource<IMessage, CreatedMessageResponse>
  | IResponseSuccessJson<CreatedMessageResponse>
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenNotAuthorizedForDryRun
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
  messageModel: MessageModel
): ICreateMessageHandler {
  return async (context, auth, userAttributes, fiscalCode, messagePayload) => {
    const userOrganization = userAttributes.organization;
    if (!userOrganization) {
      // to be able to send a message the user musy be part of an organization
      return ResponseErrorValidation(
        "Request not valid",
        "The user is not part of any organization."
      );
    }

    const eventName = "api.messages.create";
    const eventData = {
      senderOrganizationId: userOrganization.organizationId,
      senderUserId: auth.userId
    };

    if (messagePayload.dry_run) {
      // the user requested a dry run

      if (auth.groups.has(UserGroup.ApiMessageWriteDryRun)) {
        // the user is authorized for dry run calls, we respond with the
        // data that he just sent
        applicationInsightsClient.trackEvent({
          name: eventName,
          properties: {
            ...eventData,
            dryRun: "true",
            success: "true"
          }
        });
        const responsePayload: CreatedMessageResponse = {
          dry_run: true
        };
        return ResponseSuccessJson(responsePayload);
      } else {
        // the user is not authorized for dry run calls
        return ResponseErrorForbiddenNotAuthorizedForDryRun;
      }
    }

    // the user is doing a production call
    if (!auth.groups.has(UserGroup.ApiMessageWrite)) {
      // the user is doing a production call but he's not enabled
      return ResponseErrorForbiddenNotAuthorizedForProduction;
    }

    if (
      messagePayload.default_addresses &&
      !auth.groups.has(UserGroup.ApiMessageWriteDefaultAddress)
    ) {
      // the user is sending a message by providing default addresses but he's
      // not allowed to do so.
      return ResponseErrorForbiddenNotAuthorizedForDefaultAddresses;
    }

    // we need the user to be associated to a valid organization for him
    // to be able to send a message
    const message: INewMessageWithoutContent = {
      fiscalCode,
      id: toNonEmptyString(ulid()).get,
      kind: "INewMessageWithoutContent",
      senderOrganizationId: userOrganization.organizationId,
      senderUserId: auth.userId
    };

    // attempt to create the message
    const errorOrMessage = await messageModel.create(
      message,
      message.fiscalCode
    );

    if (errorOrMessage.isRight) {
      // message creation succeeded
      const retrievedMessage = errorOrMessage.right;
      context.log(
        `>> message created|${fiscalCode}|${userOrganization.organizationId}|${retrievedMessage.id}`
      );

      // when tracking the message creation event we want to know whether a
      // default email address was provided
      const hasDefaultEmail =
        messagePayload.default_addresses &&
        messagePayload.default_addresses.email
          ? "true"
          : "false";

      const hasCustomSubject = messagePayload.content.subject
        ? "true"
        : "false";

      // track the event that a message has been created
      applicationInsightsClient.trackEvent({
        name: eventName,
        properties: {
          ...eventData,
          dryRun: "false",
          hasCustomSubject,
          hasDefaultEmail,
          success: "true"
        }
      });

      const messageContent: IMessageContent = {
        bodyMarkdown: messagePayload.content.markdown,
        subject: messagePayload.content.subject
      };

      const retrievedMessageWithoutContent: IRetrievedMessageWithoutContent = {
        ...retrievedMessage,
        content: undefined,
        kind: "IRetrievedMessageWithoutContent"
      };

      // prepare the created message event
      const createdMessageEvent: ICreatedMessageEvent = {
        defaultAddresses: messagePayload.default_addresses,
        message: retrievedMessageWithoutContent,
        messageContent
      };

      // queue the message to the created messages queue by setting
      // the message to the output binding of this function
      // tslint:disable-next-line:no-object-mutation
      context.bindings.createdMessage = createdMessageEvent;

      const responsePayload: CreatedMessageResponse = {
        dry_run: false
      };

      // redirect the client to the message resource
      return ResponseSuccessRedirectToResource(
        retrievedMessage,
        `/api/v1/messages/${fiscalCode}/${message.id}`,
        responsePayload
      );
    } else {
      // we got an error while creating the message
      return ResponseErrorQuery(
        "Error while creating Message",
        errorOrMessage.left
      );
    }
  };
}

/**
 * Wraps a CreateMessage handler inside an Express request handler.
 */
export function CreateMessage(
  applicationInsightsClient: ApplicationInsights.TelemetryClient,
  organizationModel: OrganizationModel,
  messageModel: MessageModel
): express.RequestHandler {
  const handler = CreateMessageHandler(applicationInsightsClient, messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware<IBindings>(),
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageWrite, UserGroup.ApiMessageWriteDryRun])
    ),
    AzureUserAttributesMiddleware(organizationModel),
    FiscalCodeMiddleware,
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
      // that have been sent by the organization he belongs to
      if (!userAttributes.organization) {
        // the user doesn't have any organization associated, so we can't continue
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
      (userAttributes.organization &&
        retrievedMessage.senderOrganizationId ===
          userAttributes.organization.organizationId);

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
  organizationModel: OrganizationModel,
  messageModel: MessageModel,
  notificationModel: NotificationModel
): express.RequestHandler {
  const handler = GetMessageHandler(messageModel, notificationModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList])
    ),
    AzureUserAttributesMiddleware(organizationModel),
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
