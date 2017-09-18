import * as express from "express";
import * as winston from "winston";

import { Either } from "./either";
import { IResponse, ResponseErrorInternal } from "./response";

export type RequestHandler<R extends IResponse> = (request: express.Request) => Promise<R>;

/**
 * Transforms a typesafe RequestHandler into an Express Request Handler.
 *
 * Failed promises will be mapped to 500 errors handled by ResponseErrorGeneric.
 */
export function wrapRequestHandler<R extends IResponse>(handler: RequestHandler<R>): express.RequestHandler {
  return (request, response, _) => {
    handler(request).then(
      (r) => {
        r.apply(response);
        winston.log("debug", `wrapRequestHandler|SUCCESS|${request.url}|${r.kind}`);
      },
      (e) => {
        ResponseErrorInternal(e).apply(response);
        winston.log("debug", `wrapRequestHandler|ERROR|${request.url}|${e}`);
      },
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

//
// The following are the type definitions for withRequestMiddlewares(...)
// Each overloaded type provided a type safe signature of withRequestMiddlewares with
// a certain number of middlewares. This is useful for enforcing the constraint that
// the handler should have the same number of parameters as the number of middlewares
// and each parameter must be of the same type returned by the corresponding middleware.
//

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
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
): (handler: (v1: T1, v2: T2) => Promise<RH>) => RequestHandler<RH | R1 | R2>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  R3 extends IResponse,
  T1, T2, T3
>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
): (handler: (v1: T1, v2: T2, v3: T3) => Promise<RH>) => RequestHandler<RH | R1 | R2 | R3>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  R3 extends IResponse,
  R4 extends IResponse,
  T1, T2, T3, T4
>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
  v4: IRequestMiddleware<R4, T4>,
): (handler: (v1: T1, v2: T2, v3: T3, v4: T4) => Promise<RH>) => RequestHandler<RH | R1 | R2 | R3 | R4>;

export function withRequestMiddlewares<
  RH extends IResponse,
  R1 extends IResponse,
  R2 extends IResponse,
  R3 extends IResponse,
  R4 extends IResponse,
  R5 extends IResponse,
  T1, T2, T3, T4, T5
>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
  v4: IRequestMiddleware<R4, T4>,
  v5: IRequestMiddleware<R5, T5>,
): (handler: (v1: T1, v2: T2, v3: T3, v4: T4, v5: T5) => Promise<RH>) => RequestHandler<RH | R1 | R2 | R3 | R4 | R5>;

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
  R4 extends IResponse,
  R5 extends IResponse,
  T1, T2, T3, T4, T5
>(
  v1: IRequestMiddleware<R1, T1>,
  v2?: IRequestMiddleware<R2, T2>,
  v3?: IRequestMiddleware<R3, T3>,
  v4?: IRequestMiddleware<R4, T4>,
  v5?: IRequestMiddleware<R5, T5>,
): (handler: (v1: T1, v2?: T2, v3?: T3, v4?: T4, v5?: T5) => Promise<RH>) =>
  RequestHandler<R1 | R2 | R3 | R4 | R5 | RH> {
  return (handler) => {

    // The outer promise with resolve to a type that can either be the the type returned
    // by the handler or one of the types returned by any of the middlewares (i.e., when
    // a middleware returns an error response).
    return (request) => new Promise<R1 | R2 | R3 | R4 | R5 | RH>((resolve, reject) => {

      // we execute each middleware in sequence, stopping at the first middleware that is
      // undefined or when a middleware returns an error response.
      // when we find an undefined middleware, we call the handler with all the results of
      // the executed middlewares
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
                } else if (v4 !== undefined) {
                  v4(request).then((r4) => {
                    if (r4.isLeft) {
                      // 4th middleware returned a response
                      // stop processing the middlewares
                      resolve(r4.left);
                    } else if (v5 !== undefined) {
                      v5(request).then((r5) => {
                        if (r5.isLeft) {
                          // 5th middleware returned a response
                          // stop processing the middlewares
                          resolve(r5.left);
                        } else {
                          // 5th middleware returned a value
                          // run handler
                          handler(r1.right, r2.right, r3.right, r4.right, r5.right).then(resolve, reject);
                        }
                      }, reject);
                    } else {
                      // 4th middleware returned a value
                      // run handler
                      handler(r1.right, r2.right, r3.right, r4.right).then(resolve, reject);
                    }
                  }, reject);
                } else {
                  // 3rd middleware returned a value
                  // run handler
                  handler(r1.right, r2.right, r3.right).then(resolve, reject);
                }
              }, reject);
            } else {
              // 2nd middleware returned a value
              // run handler
              handler(r1.right, r2.right).then(resolve, reject);
            }
          }, reject);
        } else {
          // 1st middleware returned a value
          // run handler
          handler(r1.right).then(resolve, reject);
        }
      }, reject);

    });

  };
}
