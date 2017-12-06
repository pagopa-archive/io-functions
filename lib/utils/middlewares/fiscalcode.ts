import { FiscalCode } from "../../api/definitions/FiscalCode";

import { RequiredParamMiddleware } from "./required_param";

/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const FiscalCodeMiddleware = RequiredParamMiddleware(
  "fiscalcode",
  FiscalCode
);
