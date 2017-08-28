/*
 * Implements the API handlers for the Message resource.
 */

import * as express from "express";
import * as ulid from "ulid";

import { IContext } from "azure-function-express-cloudify";

import { left, right } from "../utils/either";

import { FiscalCode } from "../utils/fiscalcode";
import { FiscalCodeMiddleware } from "../utils/fiscalcode_middleware";
import { ContextMiddleware } from "../utils/middlewares/context_middleware";
import { RequiredIdParamMiddleware } from "../utils/middlewares/required_id_param";
import { IRequestMiddleware, withRequestMiddlewares, wrapRequestHandler } from "../utils/request_middleware";
import {
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson,
} from "../utils/response";

import { ICreatedMessageEvent } from "../models/created_message_event";
import {
  asPublicExtendedMessage,
  INewMessage,
  IPublicExtendedMessage,
  MessageModel,
} from "../models/message";

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IBindings {
  createdMessage?: ICreatedMessageEvent;
}

/**
 * A new Message payload.
 *
 * TODO: generate from a schema.
 */
interface IMessagePayload {
  body_short: string;
}

/**
 * A request middleware that validates the Message payload.
 *
 * TODO: generate from the OpenAPI specs.
 */
export const MessagePayloadMiddleware: IRequestMiddleware<IResponseErrorValidation, IMessagePayload> =
  (request) => {
    if (typeof request.body.body_short === "string") {
      return Promise.resolve(right({
        body_short: request.body.body_short,
      }));
    } else {
      const response = ResponseErrorValidation("body_short is required");
      return Promise.resolve(left(response));
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
  fiscalCode: FiscalCode,
  messagePayload: IMessagePayload,
) => Promise<IResponseSuccessJson<IPublicExtendedMessage>>;

/**
 * Type of a GetMessage handler.
 *
 * GetMessage expects a FiscalCode and a Message ID as input
 * and returns a Message as output or a Not Found or Validation
 * errors.
 */
type IGetMessageHandler = (
  fiscalCode: FiscalCode,
  messageId: string,
) => Promise<
  IResponseSuccessJson<IPublicExtendedMessage> |
  IResponseErrorNotFound |
  IResponseErrorValidation
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
  fiscalCode: FiscalCode,
) => Promise<
  IResponseSuccessJson<IPublicExtendedMessage[]> |
  IResponseErrorValidation
>;

/**
 * Returns a type safe CreateMessage handler.
 */
export function CreateMessageHandler(Message: MessageModel): ICreateMessageHandler {
  return (context, fiscalCode, messagePayload) =>
    new Promise((resolve, reject) => {

    const message: INewMessage = {
      bodyShort: messagePayload.body_short,
      fiscalCode,
      id: ulid(),
      kind: "INewMessage",
    };

    Message.createMessage(message).then((retrievedMessage) => {
      context.log(`>> message stored [${retrievedMessage.id}]`);

      const createdMessage: ICreatedMessageEvent = {
        message: retrievedMessage,
      };

      // queue the message to the created messages queue by setting
      // the message to the output binding of this function
      context.bindings.createdMessage = createdMessage;

      const publicMessage = asPublicExtendedMessage(retrievedMessage);
      resolve(ResponseSuccessJson(publicMessage));
    }, reject);
  });
}

/**
 * Wraps a CreateMessage handler inside an Express request handler.
 */
export function CreateMessage(
  handler: ICreateMessageHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware<IBindings>(),
    FiscalCodeMiddleware,
    MessagePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting a single message for a recipient.
 */
export function GetMessageHandler(Message: MessageModel): IGetMessageHandler {
  return (fiscalCode, messageId) => new Promise((resolve, reject) => {
    Message.findMessageForRecipient(fiscalCode, messageId).then((retrievedMessage) => {
      if (retrievedMessage != null) {
        const publicMessage = asPublicExtendedMessage(retrievedMessage);
        resolve(ResponseSuccessJson(publicMessage));
      } else {
        resolve(ResponseErrorNotFound("Message not found"));
      }
    }, reject);
  });
}

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
export function GetMessage(
  handler: IGetMessageHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    RequiredIdParamMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(Message: MessageModel): IGetMessagesHandler {
  return (fiscalCode) => new Promise((resolve, reject) => {
    const iterator = Message.findMessages(fiscalCode);
    iterator.executeNext().then((retrievedMessages) => {
      const publicMessages = retrievedMessages.map(asPublicExtendedMessage);
      resolve(ResponseSuccessJson(publicMessages));
    }, reject);
  });
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  handler: IGetMessagesHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
