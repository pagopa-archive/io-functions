import * as express from "express";
import * as winston from "winston";

import { Either } from "./either";
import { IResponse, ResponseErrorInternal } from "./response";

import * as async from "async";

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
        // winston.log("debug", `${e.stack}`);
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
    type IMiddlewareResponse = R1 | R2 | R3 | R4 | R5;
    type IMiddlewareResult = T1 | T2 | T3 | T4 | T5;

    // The outer promise with resolve to a type that can either be the the type returned
    // by the handler or one of the types returned by any of the middlewares (i.e., when
    // a middleware returns an error response).
    return (request) => new Promise<IMiddlewareResponse | RH>((resolve, reject) => {
      const middlewares = [ v1, v2, v3, v4, v5].filter((v) => v !== undefined);

      const task = <
        R extends IMiddlewareResponse,
        T extends IMiddlewareResult,
        M extends IRequestMiddleware<R, T>
      >
        (middleware: M | undefined) => async (cb:
        (err: Error | undefined, result?: T) => void) => {
          const response = await (middleware as M)(request);
          if (response.isLeft) {
            resolve(response.left);
            return cb(new Error(response.left.kind));
          } else {
            return cb(undefined, response.right);
          }
      };

      async.series(middlewares.map((mw) => task(mw)),
        (err: Error, results: [ T1, T2, T3, T4, T5 ]) =>
          (err) ? reject(err) :
            handler.apply(undefined, results)
              .then(resolve, reject));

    });
  };
}
