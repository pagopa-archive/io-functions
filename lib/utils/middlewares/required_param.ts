import * as t from "io-ts";

import { ResponseErrorFromValidationErrors } from "io-ts-commons/lib/responses";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function RequiredParamMiddleware<S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> {
  return request =>
    new Promise(resolve => {
      const validation = type.decode(request.params[name]);
      const result = validation.mapLeft(
        ResponseErrorFromValidationErrors(type)
      );
      resolve(result);
    });
}
