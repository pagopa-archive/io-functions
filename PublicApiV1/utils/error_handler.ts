import * as express from "express";

/**
 * Returns an error handler that responds to the current HTTP request.
 *
 * @param response The Express Response for the current request
 */
export function handleErrorAndRespond(response: express.Response): (reason: any) => any {
  return (reason: any) => {
    response.status(500).json({
      error: reason,
    });
  };
}
