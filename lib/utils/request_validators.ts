import * as express from "express";

import { FiscalCode, isFiscalCode } from "./fiscalcode";

/**
 * A Request handler that expects a validated fiscal code parameter.
 */
export type RequestWithFiscalCodeHandler = (req: express.Request, res: express.Response, fiscalcode: FiscalCode) => any;

/**
 * Adds validation for fiscal codes to a RequestWithFiscalCodeHandler.
 *
 * @param handler A Request handler that expects a validated fiscal code.
 */
export function withValidFiscalCode(handler: RequestWithFiscalCodeHandler): express.RequestHandler {
  return (request: express.Request, response: express.Response, _: express.NextFunction) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      return handler(request, response, fiscalCode);
    } else {
      response.status(400).send(`The fiscal code [${fiscalCode}] is not valid.`);
    }
  };
}
