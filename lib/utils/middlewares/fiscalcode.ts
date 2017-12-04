import * as t from "io-ts";

import { FiscalCode } from "../../api/definitions/FiscalCode";

import { IRequestMiddleware } from "../request_middleware";
import {
  IResponseErrorValidation,
  ResponseErrorFromValidationErrors
} from "../response";

/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const FiscalCodeMiddleware: IRequestMiddleware<
  IResponseErrorValidation,
  FiscalCode
> = request =>
  new Promise(resolve => {
    const validation = t.validate(request.params.fiscalcode, FiscalCode);
    const result = validation.mapLeft(
      ResponseErrorFromValidationErrors(FiscalCode)
    );
    resolve(result);
  });
