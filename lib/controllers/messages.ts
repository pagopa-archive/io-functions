/*
 * Implements the API handlers for the Message resource.
 */

import * as express from "express";
import * as ulid from "ulid";

import * as ApplicationInsights from "applicationinsights";

import { IContext } from "azure-function-express";

import { left, right } from "../utils/either";

import { FiscalCode } from "../api/definitions/FiscalCode";
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

import {
  NotificationChannelStatus,
  NotificationModel
} from "../models/notification";
import { OrganizationModel } from "../models/organization";

import {
  asPublicExtendedMessage,
  IMessage,
  INewMessage,
  IPublicExtendedMessage,
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
 * Response for successful dry run requests
 */
export interface IResponseDryRun {
  readonly status: "DRY_RUN_SUCCESS";
  readonly bodyShort: string;
  readonly senderOrganizationId: string;
}

/**
 * Response for public message data
 */
export interface IResponsePublicMessage {
  readonly message: IPublicExtendedMessage;
  readonly notification:
    | undefined
    | {
        readonly email: undefined | NotificationChannelStatus;
      };
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
  | IResponseSuccessRedirectToResource<IMessage>
  | IResponseSuccessJson<IResponseDryRun>
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
  | IResponseSuccessJson<IResponsePublicMessage>
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
  | IResponseSuccessJsonIterator<IPublicExtendedMessage>
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
      senderOrganizationId: userOrganization.organizationId
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
        const response: IResponseDryRun = {
          bodyShort: messagePayload.content.body_short,
          senderOrganizationId: userOrganization.organizationId,
          status: "DRY_RUN_SUCCESS"
        };
        return ResponseSuccessJson(response);
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
    const message: INewMessage = {
      bodyShort: messagePayload.content.body_short,
      fiscalCode,
      id: toNonEmptyString(ulid()).get,
      kind: "INewMessage",
      senderOrganizationId: userOrganization.organizationId
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

      // track the event that a message has been created
      applicationInsightsClient.trackEvent({
        name: eventName,
        properties: {
          ...eventData,
          dryRun: "false",
          hasDefaultEmail,
          success: "true"
        }
      });

      // prepare the created message event
      const createdMessageEvent: ICreatedMessageEvent = {
        defaultAddresses: messagePayload.default_addresses,
        message: retrievedMessage
      };

      // queue the message to the created messages queue by setting
      // the message to the output binding of this function
      // tslint:disable-next-line:no-object-mutation
      context.bindings.createdMessage = createdMessageEvent;

      // redirect the client to the message resource
      return ResponseSuccessRedirectToResource(
        retrievedMessage,
        `/api/v1/messages/${fiscalCode}/${message.id}`
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

    const publicMessageJson: IResponsePublicMessage = {
      message: asPublicExtendedMessage(retrievedMessage),
      notification: maybeNotificationStatus.isDefined
        ? maybeNotificationStatus.get
        : undefined
    };

    return ResponseSuccessJson(publicMessageJson);
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
      asPublicExtendedMessage
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
