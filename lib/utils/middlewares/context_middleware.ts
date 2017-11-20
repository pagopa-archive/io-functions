import * as express from "express";

import { left, right } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";

import { IRequestMiddleware } from "../request_middleware";

import { IResponseErrorInternal, ResponseErrorInternal } from "../response";

import { IContext } from "azure-function-express";

const CONTEXT_IDENTIFIER = "context";

export function setAppContext(
  app: express.Express,
  context: IContext<{}>
): void {
  app.set(CONTEXT_IDENTIFIER, context);
}

export function getAppContext<T>(
  request: express.Request
): Option<IContext<T>> {
  return fromNullable(request.app.get(CONTEXT_IDENTIFIER));
}

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export function ContextMiddleware<T>(): IRequestMiddleware<
  IResponseErrorInternal,
  IContext<T>
> {
  return request =>
    new Promise(resolve =>
      getAppContext<T>(request).fold(
        () =>
          resolve(
            left<IResponseErrorInternal, IContext<T>>(
              ResponseErrorInternal("Cannot get context from request")
            )
          ),
        context => resolve(right<IResponseErrorInternal, IContext<T>>(context))
      )
    );
}
