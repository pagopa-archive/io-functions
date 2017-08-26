import * as express from "express";

/**
 * Interface for implementing a request middleware.
 *
 * A RequestMiddleware is just a function that validates a request or
 * extracts some object out of it.
 * The middleware returns a promise that will resolve to a value that gets
 * passed to the handler.
 * In case the validation fails, the middleware rejects the promise (the
 * value of the error is discarded). In this case the processing of the
 * following middlewares will not happen.
 * Finally, when called, the middleware has full access to the request and
 * the response objects. Access to the response object is particulary useful
 * for returning error messages when the validation fails.
 */
export type IRequestMiddleware<T> = (request: express.Request, response: express.Response) => Promise<T>;

export function withRequestMiddlewares<T1>(
  v1: IRequestMiddleware<T1>,
): (handler: (_: express.Response, v1: T1) => void) => express.RequestHandler;

export function withRequestMiddlewares<T1, T2>(
  v1: IRequestMiddleware<T1>, v2: IRequestMiddleware<T2>,
): (handler: (_: express.Response, v1: T1, v2: T2) => void) => express.RequestHandler;

export function withRequestMiddlewares<T1, T2, T3>(
  v1: IRequestMiddleware<T1>, v2: IRequestMiddleware<T2>, v3: IRequestMiddleware<T3>,
): (handler: (_: express.Response, v1: T1, v2: T2, v3: T3) => void) => express.RequestHandler;

/**
 * Returns a request handler wrapped with the provided middlewares.
 */
export function withRequestMiddlewares<T1, T2, T3>(
  v1: IRequestMiddleware<T1>, v2?: IRequestMiddleware<T2>, v3?: IRequestMiddleware<T3>,
): (handler: (_: express.Response, v1: T1, v2?: T2, v3?: T3) => void) => express.RequestHandler {
  return (handler) => {
    return (request: express.Request, response: express.Response, _: express.NextFunction) => {

      v1(request, response).then((r1) => {
        if (v2 !== undefined) {
          v2(request, response).then((r2) => {
            if (v3 !== undefined) {
              v3(request, response).then((r3) => {
                handler(response, r1, r2, r3);
              });
            } else {
              handler(response, r1, r2);
            }
          });
        } else {
          handler(response, r1);
        }
      });

    };
  };
}
