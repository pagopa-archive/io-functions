import * as express from "express";

import { isFiscalCode } from "../utils/fiscalcode";

import { IMessage } from "../interfaces/message";
import { MessageModel } from "../models/message";

/**
 * Returns a createMessage controller
 *
 * @param Message The Message model.
 */
export function createMessageController(Message: MessageModel): express.RequestHandler {
  return (request: express.Request, response: express.Response) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
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
    } else {
      response.status(404).send("Not found");
    }
  };
}
