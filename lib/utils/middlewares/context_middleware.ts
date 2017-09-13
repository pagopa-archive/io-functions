import * as express from "express";

import { Option, option } from "ts-option";
import { right } from "../either";

import { IRequestMiddleware } from "../request_middleware";

import { IContext } from "azure-function-express";

const CONTEXT_IDENTIFIER = "context";

export function setAppContext(app: express.Express, context: IContext<{}>): void {
  app.set(CONTEXT_IDENTIFIER, context);
}

export function getAppContext<T>(request: express.Request): Option<IContext<T>> {
  return option(request.app.get(CONTEXT_IDENTIFIER));
}

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export function ContextMiddleware<T>(): IRequestMiddleware<never, IContext<T>> {
  return (request: express.Request) => {
    const context: IContext<T> = getAppContext<T>(request)
      .getOrElse(() => { throw new Error("Cannot get context from request"); });
    return Promise.resolve(right(context));
  };
}
