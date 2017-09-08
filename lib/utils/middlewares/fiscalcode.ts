import { FiscalCode, isFiscalCode } from "../fiscalcode";

import { left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
import { IResponseErrorValidation, ResponseErrorValidation } from "../response";

/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const FiscalCodeMiddleware: IRequestMiddleware<IResponseErrorValidation, FiscalCode> =
  (request) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      return Promise.resolve(right(fiscalCode));
    } else {
      const validationErrorResponse = ResponseErrorValidation(
        "Bad request",
        `The fiscal code [${fiscalCode}] is not valid.`,
      );
      return Promise.resolve(left(validationErrorResponse));
    }
  };
