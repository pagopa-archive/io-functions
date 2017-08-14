import * as express from "express";

import * as azure from "azure-storage";

import { FiscalCode } from "../utils/fiscalcode";
import { withValidFiscalCode } from "../utils/request_validators";

import { handleErrorAndRespond } from "../utils/error_handler";

import { IMessage } from "../interfaces/message";
import { MessageModel } from "../models/message";

/**
 * Returns a controller that will handle requests
 * for creating new messages.
 *
 * @param Message The Message model.
 */
export function CreateMessage(
  Message: MessageModel,
  queueService: azure.QueueService,
  queueName: string,
): express.RequestHandler {
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    const _log: (text: any) => any = (request as any).context.log;

    const message: IMessage = {
      bodyShort: request.body.body_short,
      fiscalCode,
    };
    _log(">> creating message");
    Message.createMessage(message).then((result) => {
      _log(`>> message created [${result._id}]`);
      queueService.createMessage(queueName, result._id as string, {}, (error) => {
        _log(`>> message queued [${error}]`);
        if (error) {
          // TODO: handle error
        }
        response.json({
          notification: true,
          result,
        });
      });
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
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    Message.findMessage(fiscalCode, request.params.id).then((result) => {
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
  return withValidFiscalCode((_: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    Message.findMessages(fiscalCode).then((result) => {
      response.json(result);
    }, handleErrorAndRespond(response));
  });
}
