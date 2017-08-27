import {
  IResponseErrorGeneric,
  IResponseSuccessJson,
  ResponseErrorGeneric,
  ResponseSuccessJson,
} from "./response";

/**
 * Returns an error handler that responds to the current HTTP request.
 *
 * @param response The Express Response for the current request
 */
export function handleErrorAndRespond<T>(): (reason: T) => IResponseErrorGeneric {
  return (reason: T) => {
    return ResponseErrorGeneric(`Generic error: ${reason}`);
  };
}

/**
 * Returns an error handler that responds to the current HTTP request.
 */
export function handleNullableResultAndRespond<T>(
  resolve: (value: IResponseSuccessJson<T> | IResponseErrorGeneric) => void,
  nullErrorMessage: string,
): ((result: T | null) => void) {
  return (result) => {
    if (result !== null) {
      resolve(ResponseSuccessJson(result));
    } else {
      resolve(ResponseErrorGeneric(nullErrorMessage));
    }
  };
}
