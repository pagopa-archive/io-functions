import { left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
import { IResponseErrorValidation, ResponseErrorValidation } from "../response";

/**
 * A request middleware that validates the presence of a valid `param` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const PathParamMiddleware: <T>(
  paramName: string,
  // tslint:disable-next-line:no-any
  testfn: (arg: any) => arg is T
) => IRequestMiddleware<IResponseErrorValidation, T> = (
  paramName,
  testFn
) => request => {
  const paramValue: string = request.params[paramName];
  if (testFn(paramValue)) {
    return Promise.resolve(right(paramValue));
  } else {
    const validationErrorResponse = ResponseErrorValidation(
      "Bad request",
      `The value of path param [${paramName}] is not valid.`
    );
    return Promise.resolve(left(validationErrorResponse));
  }
};
