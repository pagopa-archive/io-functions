import * as express from "express";
import * as ulid from "ulid";

import { FiscalCodeMiddleware } from "../utils/fiscalcode_middleware";
import { ContextMiddleware } from "../utils/middlewares/context_middleware";
import { RequiredIdParamMiddleware } from "../utils/middlewares/required_id_param";
import { IRequestMiddleware, withRequestMiddlewares } from "../utils/request_middleware";

import { handleErrorAndRespond } from "../utils/error_handler";

import { ICreatedMessageEvent } from "../models/created_message_event";
import { INewMessage, MessageModel } from "../models/message";

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

export const MessagePayloadMiddleware: IRequestMiddleware<IMessagePayload> =
  (request, response) => {
    if (typeof request.body.body_short === "string") {
      return Promise.resolve({
        body_short: request.body.body_short,
      });
    } else {
      response.send(400).json({ error: "body_short is required" });
      return Promise.reject(null);
    }
  };

/**
 * Returns a controller that will handle requests
 * for creating new messages.
 *
 * @param Message The Message model.
 */
export function CreateMessage(
  Message: MessageModel,
): express.RequestHandler {
  return withRequestMiddlewares(ContextMiddleware<IBindings>(), FiscalCodeMiddleware, MessagePayloadMiddleware)(
    (response, context, fiscalCode, messagePayload) => {

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
      response.json(result);

    }, handleErrorAndRespond(response));

  });
}

/**
 * Returns a controller that will handle requests
 * for getting a single message for a recipient.
 *
 * @param Message The Message model
 */
export function GetMessage(Message: MessageModel): express.RequestHandler {
  return withRequestMiddlewares(FiscalCodeMiddleware, RequiredIdParamMiddleware)((response, fiscalCode, messageId) => {
    Message.findMessageForRecipient(fiscalCode, messageId).then((result) => {
      if (result != null) {
        response.json(result);
      } else {
        response.status(404).send("Message not found");
      }
    }, handleErrorAndRespond(response));
  });
}

/**
 * Returns a controller that will handle requests
 * for getting all messages for a recipient.
 *
 * @param Message The Message model
 */
export function GetMessages(Message: MessageModel): express.RequestHandler {
  return withRequestMiddlewares(FiscalCodeMiddleware)((response, fiscalCode) => {
    const iterator = Message.findMessages(fiscalCode);
    iterator.executeNext().then((result) => {
      response.json(result);
    }, handleErrorAndRespond(response));
  });
}
