import * as express from "express";

/**
 * Returns an error handler that responds to the current HTTP request.
 *
 * @param response The Express Response for the current request
 */
export function handleErrorAndRespond<T>(response: express.Response): (reason: T) => express.Response {
  return (reason: T) => {
    return response.status(500).json({
      error: reason,
    });
  };
}

/**
 * Returns an error handler that responds to the current HTTP request.
 *
 * @param response The Express Response for the current request
 */
export function handleNullableResultAndRespond<T, E>(
  response: express.Response,
  errorStatus: number,
  nullError: E,
): (result: T | null) => express.Response {
  return (result: T | null) => {
    if (result !== null) {
      return response.status(200).json(result);
    } else {
      return response.status(errorStatus).json(nullError);
    }
  };
}
