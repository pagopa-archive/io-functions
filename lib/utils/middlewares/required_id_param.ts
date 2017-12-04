import { left, right } from "fp-ts/lib/Either";

import { NonEmptyString } from "../strings";

import { RequiredParamMiddleware } from "./required_param";

/**
 * Returns an instance of RequiredParamMiddleware that extracts a non-empty "id"
 * parametere from the request URI parameters.
 */
export const RequiredIdParamMiddleware = RequiredParamMiddleware<
  NonEmptyString
>(params => {
  const idParam = params.id;
  if (NonEmptyString.is(idParam)) {
    return right(idParam);
  } else {
    return left("The 'id' parameter is required and must be non-empty.");
  }
});
