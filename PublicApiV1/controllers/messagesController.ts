import * as express from "express";

import { FiscalCode } from "../utils/fiscalcode";
import { withValidFiscalCode } from "../utils/request_validators";

import { IMessage } from "../interfaces/message";
import { MessageModel } from "../models/message";

/**
 * Returns a createMessage controller that will handle requests
 * for creating new messages.
 *
 * @param Message The Message model.
 */
export function createMessageController(Message: MessageModel): express.RequestHandler {
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    const message: IMessage = {
      bodyShort: request.body.body_short,
      fiscalCode,
    };
    Message.createMessage(message).then((result) => {
      if (result != null) {
        response.json(result);
      } else {
        response.status(500).send("Did not create");
      }
    },
    (error) => {
      response.status(500).json({
        error,
      });
    });
  });
}
