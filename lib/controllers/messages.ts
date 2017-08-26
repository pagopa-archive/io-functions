import * as express from "express";

import * as ulid from "ulid";

import { FiscalCode } from "../../lib/utils/fiscalcode";
import { withValidFiscalCode } from "../../lib/utils/request_validators";

import { handleErrorAndRespond } from "../../lib/utils/error_handler";

import { ICreatedMessageEvent } from "../models/created_message_event";
import { INewMessage, MessageModel } from "../models/message";
import { IContextWithBindings } from "../types/context";

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IBindings {
  createdMessage?: ICreatedMessageEvent;
}

/**
 * Returns a controller that will handle requests
 * for creating new messages.
 *
 * @param Message The Message model.
 */
export function CreateMessage(Message: MessageModel): express.RequestHandler {
  return withValidFiscalCode(
    (
      request: express.Request,
      response: express.Response,
      fiscalCode: FiscalCode,
    ) => {
      const context: IContextWithBindings<IBindings> = request.context;

      const message: INewMessage = {
        bodyShort: request.body.body_short,
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
    },
  );
}

/**
 * Returns a controller that will handle requests
 * for getting a single message for a recipient.
 *
 * @param Message The Message model
 */
export function GetMessage(Message: MessageModel): express.RequestHandler {
  return withValidFiscalCode(
    (
      request: express.Request,
      response: express.Response,
      fiscalCode: FiscalCode,
    ) => {
      Message.findMessageForRecipient(
        fiscalCode,
        request.params.id,
      ).then((result) => {
        if (result != null) {
          response.json(result);
        } else {
          response.status(404).send("Message not found");
        }
      }, handleErrorAndRespond(response));
    },
  );
}

/**
 * Returns a controller that will handle requests
 * for getting all messages for a recipient.
 *
 * @param Message The Message model
 */
export function GetMessages(Message: MessageModel): express.RequestHandler {
  return withValidFiscalCode(
    (
      _: express.Request,
      response: express.Response,
      fiscalCode: FiscalCode,
    ) => {
      const iterator = Message.findMessages(fiscalCode);
      iterator.executeNext().then((result) => {
        response.json(result);
      }, handleErrorAndRespond(response));
    },
  );
}
