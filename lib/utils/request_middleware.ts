import * as express from "express";

import { Either } from "./either";
import { IResponse, ResponseErrorGeneric } from "./response";

export type RequestHandler<R extends IResponse> = (request: express.Request) => Promise<R>;

export function wrapRequestHandler<R extends IResponse>(handler: RequestHandler<R>): express.RequestHandler {
  return (request, response, _) => {
    handler(request).then(
      (r) => r.apply(response),
      (e) => ResponseErrorGeneric(e).apply(response),
    );
  };
}

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
export type IRequestMiddleware<R extends IResponse, T> =
  (request: express.Request) => Promise<Either<R, T>>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  T1
>(
  v1: IRequestMiddleware<R1, T1>,
): (handler: (v1: T1) => Promise<RH>) => RequestHandler<RH | R1>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  T1, T2
>(
  v1: IRequestMiddleware<R1, T1>, v2: IRequestMiddleware<R2, T2>,
): (handler: (v1: T1, v2: T2) => Promise<RH>) => RequestHandler<RH | R1 | R2>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  R3 extends IResponse,
  T1, T2, T3
>(
  v1: IRequestMiddleware<R1, T1>, v2: IRequestMiddleware<R2, T2>, v3: IRequestMiddleware<R3, T3>,
): (handler: (v1: T1, v2: T2, v3: T3) => Promise<RH>) => RequestHandler<RH | R1 | R2 | R3>;

/**
 * Returns a request handler wrapped with the provided middlewares.
 *
 * The wrapper will process the request with each provided middleware in sequence.
 * Each middleware will return a response or a value.
 * When a response gets returned, the response gets sent back to the client and the
 * processing stops.
 * When all the provided middlewares complete by returning a value, all the values
 * gets passed to the custom handler that in turn will return a response.
 * That final response gets sent to the client.
 */
export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  R3 extends IResponse,
  T1, T2, T3
>(
  v1: IRequestMiddleware<R1, T1>,
  v2?: IRequestMiddleware<R2, T2>,
  v3?: IRequestMiddleware<R3, T3>,
): (handler: (v1: T1, v2?: T2, v3?: T3) => Promise<RH>) => RequestHandler<R1 | R2 | R3 | RH> {
  return (handler) => {

    return (request) => new Promise<R1 | R2 | R3 | RH>((resolve, reject) => {

      v1(request).then((r1) => {
        if (r1.isLeft) {
          // 1st middleware returned a response
          // stop processing the middlewares
          resolve(r1.left);
        } else if (v2 !== undefined) {
          // 1st middleware returned a value
          // process 2nd middleware
          v2(request).then((r2) => {
            if (r2.isLeft) {
              // 2nd middleware returned a response
              // stop processing the middlewares
              resolve(r2.left);
            } else if (v3 !== undefined) {
              // process 3rd middleware
              v3(request).then((r3) => {
                if (r3.isLeft) {
                  // 3rd middleware returned a response
                  // stop processing the middlewares
                  resolve(r3.left);
                } else {
                  // 3rd middleware returned a value
                  // run handler
                  handler(r1.right, r2.right, r3.right).then(resolve, reject);
                }
              });
            } else {
              // 2nd middleware returned a value
              // run handler
              handler(r1.right, r2.right).then(resolve, reject);
            }
          });
        } else {
          // 1st middleware returned a value
          // run handler
          handler(r1.right).then(resolve, reject);
        }
      });

    });

  };
}
