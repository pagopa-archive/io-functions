import { Either, left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
import { IResponseErrorValidation, ResponseErrorValidation } from "../response";

type ParameterType = string | number | object;

interface IRequestParameters {
  readonly [key: string]: ParameterType;
}

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param f       A function that should extract the required parameter from
 *                the params object or return an error string.
 */
export function RequiredParamMiddleware<T>(
  f: (params: IRequestParameters) => Either<string, T>,
): IRequestMiddleware<IResponseErrorValidation, T> {
  return ((request) => {
    const v = f(request.params);
    if (v.isRight) {
      return Promise.resolve(right(v.right));
    } else {
      const response = ResponseErrorValidation("A required parameter is missing", v.left);
      return Promise.resolve(left(response));
    }
  });
}
