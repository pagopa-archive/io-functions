import * as express from "express";
import * as winston from "winston";

import { Either, isLeft, right } from "fp-ts/lib/Either";

import { Task } from "fp-ts/lib/Task";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { IResponse, ResponseErrorInternal } from "./response";
import { fromTask, processTaskEithers } from "./tasks";

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
    return handler(request).then(
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

/**
 * A no-op middleware used for the "internal" purpouse of setting
 * default values in the wrapMiddleWareHandler function.
 */
const dummyMiddleware: IRequestMiddleware<never, undefined> = async (
  _: express.Request
) => {
  return right(undefined);
};

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
  RH,
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
): (
  handler: (
    v1: T1,
    v2?: T2,
    v3?: T3,
    v4?: T4,
    v5?: T5,
    v6?: T6
  ) => Promise<IResponse<RH>>
) => RequestHandler<RH | R1 | R2 | R3 | R4 | R5 | R6> {
  // The outer promise with resolve to a type that can either be the the type returned
  // by the handler or one of the types returned by any of the middlewares (i.e., when
  // a middleware returns an error response).
  return handler => async request => {
    // tslint:disable-next-line:readonly-array
    const tasks: [
      TaskEither<IResponse<R1>, T1>,
      TaskEither<IResponse<R2>, T2 | undefined>,
      TaskEither<IResponse<R3>, T3 | undefined>,
      TaskEither<IResponse<R4>, T4 | undefined>,
      TaskEither<IResponse<R5>, T5 | undefined>,
      TaskEither<IResponse<R6>, T6 | undefined>
    ] = [
      fromTask(() => v1(request)),
      fromTask(() => (v2 || dummyMiddleware)(request)),
      fromTask(() => (v3 || dummyMiddleware)(request)),
      fromTask(() => (v4 || dummyMiddleware)(request)),
      fromTask(() => (v5 || dummyMiddleware)(request)),
      fromTask(() => (v6 || dummyMiddleware)(request))
    ];

    // run middlewares sequentially
    // and collect their output results
    const responseOrResults = await processTaskEithers(
      tasks[0],
      tasks[1],
      tasks[2],
      tasks[3],
      tasks[4],
      tasks[5]
    ).run();

    if (isLeft(responseOrResults)) {
      // middleware returned a response
      return responseOrResults.value;
    }

    const results = responseOrResults.value;

    // these overloads are needed to preserve argument types
    // the alternative is to just call handler(...results)
    // tslint:disable-next-line:readonly-array
    const handlers = [
      new Task(() => handler(results[0])),
      new Task(() => handler(results[0], results[1])),
      new Task(() => handler(results[0], results[1], results[2])),
      new Task(() => handler(results[0], results[1], results[2], results[3])),
      new Task(() =>
        handler(results[0], results[1], results[2], results[3], results[4])
      ),
      new Task(() =>
        handler(
          results[0],
          results[1],
          results[2],
          results[3],
          results[4],
          results[5]
        )
      )
    ];

    return handlers[arguments.length - 1].run();
  };
}
