import { Either, left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
import { IResponseErrorValidation, ResponseErrorValidation } from "../response";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param f       A function that should extract the required parameter from
 *                the params object or return an error string.
 */
export function RequiredParamMiddleware<T>(
  // tslint:disable-next-line:no-any
  f: (params: any) => Either<string, T>,
): IRequestMiddleware<IResponseErrorValidation, T> {
  return ((request) => {
    const v = f(request.params);
    if (v.isRight) {
      return Promise.resolve(right(v.right));
    } else {
      const response = ResponseErrorValidation("Validation error", v.left);
      return Promise.resolve(left(response));
    }
  });
}
