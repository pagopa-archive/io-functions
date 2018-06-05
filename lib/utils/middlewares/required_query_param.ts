import * as t from "io-ts";

import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function RequiredQueryParamMiddleware<S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> {
  return async request =>
    type
      .decode(request.query[name])
      .mapLeft(ResponseErrorFromValidationErrors(type));
}
