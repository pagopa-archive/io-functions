import { Option } from "ts-option";

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
    return ResponseErrorGeneric(500, "Internal server error", `${reason}`);
  };
}

/**
 * Returns an error handler that responds to the current HTTP request.
 */
export function handleOptionalResultAndRespond<T>(
  resolve: (value: IResponseSuccessJson<T> | IResponseErrorGeneric) => void,
  emptyErrorMessage: string,
): ((result: Option<T>) => void) {
  return (maybeResult) => maybeResult.map((result) => {
    resolve(ResponseSuccessJson(result));
  }).getOrElse(() => {
    resolve(ResponseErrorGeneric(500, "Internal server error", emptyErrorMessage));
  });
}
