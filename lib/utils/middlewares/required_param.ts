import { Either, isRight, left, right } from "fp-ts/lib/Either";

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
  f: (params: IRequestParameters) => Either<string, T>
): IRequestMiddleware<IResponseErrorValidation, T> {
  return request => {
    const v = f(request.params);
    if (isRight(v)) {
      return Promise.resolve(right<IResponseErrorValidation, T>(v.value));
    } else {
      const response = ResponseErrorValidation(
        "A required parameter is missing",
        v.value
      );
      return Promise.resolve(left<IResponseErrorValidation, T>(response));
    }
  };
}
