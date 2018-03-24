import * as express from "express";
import * as winston from "winston";

import { array } from "fp-ts/lib/Array";
import { Either } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import { sequence } from "fp-ts/lib/Traversable";

const fromTask = <L, R>(p: () => Promise<Either<L, R>>) =>
  new TaskEither(new Task(p));

const processTasks = sequence(taskEither, array);

import { IResponse, ResponseErrorInternal } from "./response";

export type RequestHandler<R> = (
  request: express.Request
) => Promise<IResponse<R>>;

/**
 * Transforms a typesafe RequestHandler into an Express Request Handler.
 *
 * Failed promises will be mapped to 500 errors handled by ResponseErrorGeneric.
 */
export function wrapRequestHandler<R>(
  handler: RequestHandler<R>
): express.RequestHandler {
  return (request, response, _) => {
    handler(request).then(
      r => {
        r.apply(response);
        winston.log(
          "debug",
          `wrapRequestHandler|SUCCESS|${request.url}|${r.kind}`
        );
      },
      e => {
        ResponseErrorInternal(e).apply(response);
        winston.log("debug", `wrapRequestHandler|ERROR|${request.url}|${e}`);
      }
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
export type IRequestMiddleware<R, T> = (
  request: express.Request
) => Promise<Either<IResponse<R>, T>>;

//
// The following are the type definitions for withRequestMiddlewares(...)
// Each overloaded type provided a type safe signature of withRequestMiddlewares with
// a certain number of middlewares. This is useful for enforcing the constraint that
// the handler should have the same number of parameters as the number of middlewares
// and each parameter must be of the same type returned by the corresponding middleware.
//

export function withRequestMiddlewares<R1, T1>(
  v1: IRequestMiddleware<R1, T1>
): <RH>(handler: (v1: T1) => Promise<IResponse<RH>>) => RequestHandler<RH | R1>;

export function withRequestMiddlewares<R1, R2, T1, T2>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>
): <RH>(
  handler: (v1: T1, v2: T2) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2>;

export function withRequestMiddlewares<R1, R2, R3, T1, T2, T3>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>
): <RH>(
  handler: (v1: T1, v2: T2, v3: T3) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2 | R3>;

export function withRequestMiddlewares<R1, R2, R3, R4, T1, T2, T3, T4>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
  v4: IRequestMiddleware<R4, T4>
): <RH>(
  handler: (v1: T1, v2: T2, v3: T3, v4: T4) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2 | R3 | R4>;

export function withRequestMiddlewares<R1, R2, R3, R4, R5, T1, T2, T3, T4, T5>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
  v4: IRequestMiddleware<R4, T4>,
  v5: IRequestMiddleware<R5, T5>
): <RH>(
  handler: (v1: T1, v2: T2, v3: T3, v4: T4, v5: T5) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2 | R3 | R4 | R5>;

export function withRequestMiddlewares<
  R1,
  R2,
  R3,
  R4,
  R5,
  R6,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6
>(
  v1: IRequestMiddleware<R1, T1>,
  v2: IRequestMiddleware<R2, T2>,
  v3: IRequestMiddleware<R3, T3>,
  v4: IRequestMiddleware<R4, T4>,
  v5: IRequestMiddleware<R5, T5>,
  v6: IRequestMiddleware<R6, T6>
): <RH>(
  handler: (
    v1: T1,
    v2: T2,
    v3: T3,
    v4: T4,
    v5: T5,
    v6: T6
  ) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2 | R3 | R4 | R5 | R6>;

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
  R1,
  R2,
  R3,
  R4,
  R5,
  R6,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6
>(
  v1: IRequestMiddleware<R1, T1>,
  v2?: IRequestMiddleware<R2, T2>,
  v3?: IRequestMiddleware<R3, T3>,
  v4?: IRequestMiddleware<R4, T4>,
  v5?: IRequestMiddleware<R5, T5>,
  v6?: IRequestMiddleware<R6, T6>
): <RH>(
  handler: (
    v1: T1,
    v2?: T2,
    v3?: T3,
    v4?: T4,
    v5?: T5,
    v6?: T6
  ) => Promise<IResponse<RH>>
) => RequestHandler<R1 | R2 | R3 | R4 | R5 | R6 | RH> {
  return withRequestMiddlewaresAr([v1, v2, v3, v4, v5, v6]);
}

/* tslint:disable:no-any */
/* tslint:disable:readonly-array */
function withRequestMiddlewaresAr(
  mws: ReadonlyArray<IRequestMiddleware<any, any> | undefined>
): (
  handler: (...args: any[]) => Promise<IResponse<any>>
) => RequestHandler<any> {
  // The outer promise with resolve to a type that can either be the the type returned
  // by the handler or one of the types returned by any of the middlewares (i.e., when
  // a middleware returns an error response).
  return handler => request =>
    // run middlewares sequentially
    // and collect their output results
    processTasks(
      mws.reduce(
        (prev: Array<TaskEither<any, any>>, mw) =>
          prev.concat(mw ? [fromTask(() => mw(request))] : []),
        []
      )
    )
      .run()
      .then(responseOrResults =>
        responseOrResults.fold(
          // one middleware returned a response
          response => response,
          // all middlewares returned a result
          results => handler(...results)
        )
      );
}

/* tslint:enable:no-any */
/* tslint:enable:readonly-array */
