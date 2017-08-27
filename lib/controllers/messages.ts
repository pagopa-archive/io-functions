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
import { INewMessage, IRetrievedMessage, MessageModel } from "../models/message";

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IBindings {
  createdMessage?: ICreatedMessageEvent;
}

interface IMessagePayload {
  body_short: string;
}

/**
 * A request middleware that validates the Message payload.
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

type ICreateMessageHandler = (
  context: IContext<IBindings>,
  fiscalCode: FiscalCode,
  messagePayload: IMessagePayload,
) => Promise<IResponseSuccessJson<IRetrievedMessage>>;

export function CreateMessageHandler(Message: MessageModel): ICreateMessageHandler {
  return (context, fiscalCode, messagePayload) =>
    new Promise((resolve, reject) => {

    const message: INewMessage = {
      bodyShort: messagePayload.body_short,
      fiscalCode,
      id: ulid(),
    };

    Message.createMessage(message).then((result) => {
      context.log(`>> message stored [${result.id}]`);

      const createdMessage: ICreatedMessageEvent = {
        message: result,
      };

      // queue the message to the created messages queue by setting
      // the message to the output binding of this function
      context.bindings.createdMessage = createdMessage;

      // TODO: this will return all internal attrs, only return "public" attributes
      resolve(ResponseSuccessJson(result));
    }, reject);
  });
}

/**
 * Returns a controller that will handle requests
 * for creating new messages.
 *
 * @param Message The Message model.
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

type IGetMessageHandler = (
  fiscalCode: FiscalCode,
  messageId: string,
) => Promise<
  IResponseSuccessJson<IRetrievedMessage> |
  IResponseErrorNotFound |
  IResponseErrorValidation
>;

export function GetMessageHandler(Message: MessageModel): IGetMessageHandler {
  return (fiscalCode, messageId) => new Promise((resolve, reject) => {
    Message.findMessageForRecipient(fiscalCode, messageId).then((result) => {
      if (result != null) {
        resolve(ResponseSuccessJson(result));
      } else {
        resolve(ResponseErrorNotFound("Message not found"));
      }
    }, reject);
  });
}

/**
 * Returns a controller that will handle requests
 * for getting a single message for a recipient.
 *
 * @param Message The Message model
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

type IGetMessagesHandler = (
  fiscalCode: FiscalCode,
) => Promise<
  IResponseSuccessJson<IRetrievedMessage[]> |
  IResponseErrorValidation
>;

export function GetMessagesHandler(Message: MessageModel): IGetMessagesHandler {
  return (fiscalCode) => new Promise((resolve, reject) => {
    const iterator = Message.findMessages(fiscalCode);
    iterator.executeNext().then((result) => {
      resolve(ResponseSuccessJson(result));
    }, reject);
  });
}

/**
 * Returns a controller that will handle requests
 * for getting all messages for a recipient.
 *
 * @param Message The Message model
 */
export function GetMessages(
  handler: IGetMessagesHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
