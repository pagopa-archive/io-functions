import * as t from "io-ts";

import { IRequestMiddleware } from "../request_middleware";
import { ResponseErrorFromValidationErrors } from "../response";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function RequiredParamMiddleware<S, A>(
  name: string,
  type: t.Type<S, A>
): IRequestMiddleware<"IResponseErrorValidation", A> {
  return request =>
    new Promise(resolve => {
      const validation = t.validate(request.params[name], type);
      const result = validation.mapLeft(
        ResponseErrorFromValidationErrors(type)
      );
      resolve(result);
    });
}
