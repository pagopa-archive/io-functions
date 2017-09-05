/*
 * Implements the API handlers for the Message resource.
 */

import * as express from "express";
import * as ulid from "ulid";

import { IContext } from "azure-function-express-cloudify";

import { left, right } from "../utils/either";

import { FiscalCode } from "../utils/fiscalcode";
import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup,
} from "../utils/middlewares/azure_api_auth";
import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes,
} from "../utils/middlewares/azure_user_attributes";
import { ContextMiddleware } from "../utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "../utils/middlewares/fiscalcode";
import { RequiredIdParamMiddleware } from "../utils/middlewares/required_id_param";
import { IRequestMiddleware, withRequestMiddlewares, wrapRequestHandler } from "../utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGeneric,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessJsonIterator,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGeneric,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson,
  ResponseSuccessJsonIterator,
  ResponseSuccessRedirectToResource,
} from "../utils/response";

import { mapResultIterator } from "../utils/documentdb";

import { ICreatedMessageEvent } from "../models/created_message_event";

import {
  OrganizationModel,
} from "../models/organization";

import {
  asPublicExtendedMessage,
  IMessage,
  INewMessage,
  IPublicExtendedMessage,
  MessageModel,
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
 * A new Message payload.
 *
 * TODO: generate from a schema.
 */
export interface IMessagePayload {
  readonly body_short: string;
  readonly dry_run: boolean;
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
 * A request middleware that validates the Message payload.
 *
 * TODO: generate from the OpenAPI specs.
 */
export const MessagePayloadMiddleware: IRequestMiddleware<IResponseErrorValidation, IMessagePayload> =
  (request) => {
    const body = request.body;
    // validate body
    if (typeof body.body_short !== "string") {
      return Promise.resolve(left(ResponseErrorValidation("body_short is required")));
    }
    // validate dry_run
    if (body.dry_run && typeof body.dry_run !== "boolean") {
      return Promise.resolve(left(ResponseErrorValidation("dry_run must be a boolean")));
    }
    return Promise.resolve(right({
      body_short: body.body_short,
      dry_run: body.dry_run,
    }));
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
  messagePayload: IMessagePayload,
) => Promise<
  IResponseSuccessRedirectToResource<IMessage> |
  IResponseSuccessJson<IResponseDryRun> |
  IResponseErrorValidation |
  IResponseErrorForbiddenNotAuthorized |
  IResponseErrorGeneric
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
  messageId: string,
) => Promise<
  IResponseSuccessJson<IPublicExtendedMessage> |
  IResponseErrorNotFound |
  IResponseErrorGeneric |
  IResponseErrorValidation |
  IResponseErrorForbiddenNotAuthorized
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
  fiscalCode: FiscalCode,
) => Promise<
  IResponseSuccessJsonIterator<IPublicExtendedMessage> |
  IResponseErrorValidation
>;

/**
 * Returns a type safe CreateMessage handler.
 */
export function CreateMessageHandler(messageModel: MessageModel): ICreateMessageHandler {
  return async (context, _, userAttributes, fiscalCode, messagePayload) => {
    const userOrganization = userAttributes.organization;
    if (!userOrganization) {
      // to be able to send a message the user musy be part of an organization
      return(ResponseErrorValidation("The user is not part of any organization."));
    }

    if (messagePayload.dry_run) {
      // if the user requested a dry run, we respond with the attributes
      // that we received
      const response: IResponseDryRun = {
        bodyShort: messagePayload.body_short,
        senderOrganizationId: userOrganization.organizationId,
        status: "DRY_RUN_SUCCESS",
      };
      return(ResponseSuccessJson(response));
    } else if (!userAttributes.productionEnabled) {
      // the user is doing a production call but he's not enabled
      return(ResponseErrorForbiddenNotAuthorized);
    }

    // we need the user to be associated to a valid organization for him
    // to be able to send a message
    const message: INewMessage = {
      bodyShort: messagePayload.body_short,
      fiscalCode,
      id: ulid(),
      kind: "INewMessage",
      senderOrganizationId: userOrganization.organizationId,
    };

    // attempt to create the message
    const errorOrMessage = await messageModel.create(message, message.fiscalCode);

    if (errorOrMessage.isRight) {
      // message creation succeeded
      const retrievedMessage = errorOrMessage.right;
      context.log(`>> message created|${fiscalCode}|${userOrganization.organizationId}|${retrievedMessage.id}`);

      // prepare the created message event
      const createdMessageEvent: ICreatedMessageEvent = {
        message: retrievedMessage,
      };

      // queue the message to the created messages queue by setting
      // the message to the output binding of this function
      // tslint:disable-next-line:no-object-mutation
      context.bindings.createdMessage = createdMessageEvent;

      // redirect the client to the message resource
      return(ResponseSuccessRedirectToResource(retrievedMessage, `/api/v1/messages/${fiscalCode}/${message.id}`));
    } else {
      // we got an error while creating the message
      return(ResponseErrorGeneric(`Error while creating Message|${errorOrMessage.left.code}`));
    }

  };
}

/**
 * Wraps a CreateMessage handler inside an Express request handler.
 */
export function CreateMessage(
  organizationModel: OrganizationModel,
  messageModel: MessageModel,
): express.RequestHandler {
  const handler = CreateMessageHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware<IBindings>(),
    AzureApiAuthMiddleware(new Set([
      UserGroup.Developers,
    ])),
    AzureUserAttributesMiddleware(organizationModel),
    FiscalCodeMiddleware,
    MessagePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting a single message for a recipient.
 */
export function GetMessageHandler(messageModel: MessageModel): IGetMessageHandler {
  return async (userAuth, userAttributes, fiscalCode, messageId) => {
    // whether the user is a trusted application (i.e. can access al inboxes)
    const isTrustedApplication = userAuth.groups.has(UserGroup.TrustedApplications);
    if (!isTrustedApplication) {
      // since this is not a trusted application we must allow only accessing messages
      // that have been sent by this organization
      if (!userAttributes.organization) {
        // the user doesn't have any organization associated, so we can't continue
        return(ResponseErrorForbiddenNotAuthorized);
      }
    }
    const errorOrMaybeDocument = await messageModel.findMessageForRecipient(fiscalCode, messageId);
    if (errorOrMaybeDocument.isRight) {
      const maybeDocument = errorOrMaybeDocument.right;
      if (maybeDocument.isDefined) {
        const retrievedMessage = maybeDocument.get;
        if (isTrustedApplication) {
          // the user is a trusted application, we can share the message
          const publicMessage = asPublicExtendedMessage(retrievedMessage);
          return ResponseSuccessJson(publicMessage);
        } else if (
          userAttributes.organization &&
          retrievedMessage.senderOrganizationId === userAttributes.organization.organizationId
        ) {
          // the user is the sender of this message, we can share it with him
          // TODO: share also notification status
          const publicMessage = asPublicExtendedMessage(retrievedMessage);
          return ResponseSuccessJson(publicMessage);
        } else {
          // the user is not the sender of the message, then he is not authorized
          return(ResponseErrorForbiddenNotAuthorized);
        }
      } else {
        return ResponseErrorNotFound("Message not found");
      }
    } else {
      return(ResponseErrorGeneric(`Error while retrieving the message|${errorOrMaybeDocument.left.code}`));
    }
  };
}

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
export function GetMessage(
  organizationModel: OrganizationModel,
  messageModel: MessageModel,
): express.RequestHandler {
  const handler = GetMessageHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([
      // trusted applications will be able to access all messages
      UserGroup.TrustedApplications,
      // developers will be able to access only messages they sent
      UserGroup.Developers,
    ])),
    AzureUserAttributesMiddleware(organizationModel),
    FiscalCodeMiddleware,
    RequiredIdParamMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(messageModel: MessageModel): IGetMessagesHandler {
  return async (_, fiscalCode) => {
    const retrievedMessagesIterator = await messageModel.findMessages(fiscalCode);
    const publicExtendedMessagesIterator = mapResultIterator(
      retrievedMessagesIterator,
      asPublicExtendedMessage,
    );
    return(ResponseSuccessJsonIterator(publicExtendedMessagesIterator));
  };
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel,
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([
      UserGroup.TrustedApplications,
    ])),
    FiscalCodeMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
