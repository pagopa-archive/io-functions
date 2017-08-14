import * as express from "express";

import * as azure from "azure-storage";

import { FiscalCode } from "../../lib/utils/fiscalcode";
import { withValidFiscalCode } from "../../lib/utils/request_validators";

import { handleErrorAndRespond } from "../../lib/utils/error_handler";

import { IMessage } from "../../lib/interfaces/message";
import { MessageModel } from "../../lib/models/message";

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

    Message.createMessage(message).then((result) => {
      _log(`>> message stored [${result._id}]`);
      const createdMessage = {
        messageId: `${result._id}`,
      };
      queueService.createMessage(queueName, JSON.stringify(createdMessage), {}, (error) => {
        _log(`>> notification queued [${result._id}]`);
        // TODO: handle queue error
        response.json({
          notification: error == null,
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
    Message.findMessageForRecipient(fiscalCode, request.params.id).then((result) => {
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
