import { isFiscalCode } from "../../api/definitions/FiscalCode";
import { PathParamMiddleware } from "./path_param";
/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const FiscalCodeMiddleware = PathParamMiddleware(
  "fiscalcode",
  isFiscalCode
);
