import * as express from "express";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";

import { IMessage } from "../interfaces/message";
import { MessageModel } from "../models/message";

type RequestWithFiscalCodeHandler = (req: express.Request, res: express.Response, fiscalcode: FiscalCode) => any;

function withValidFiscalCode(handler: RequestWithFiscalCodeHandler): express.RequestHandler {
  return (request: express.Request, response: express.Response, _: express.NextFunction) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      return handler(request, response, fiscalCode);
    } else {
      response.status(400).send(`The fiscal code [${fiscalCode}] is not valid.`);
    }
  };
}

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
