import { TaxCode } from "../../api/definitions/TaxCode";

import { RequiredParamMiddleware } from "./required_param";

/**
 * A request middleware that validates the presence of a valid `taxcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const TaxCodeMiddleware = RequiredParamMiddleware(
  "taxcode",
  TaxCode
);
