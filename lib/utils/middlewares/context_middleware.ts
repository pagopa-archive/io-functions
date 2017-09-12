import * as express from "express";

import { right } from "../either";

import { IRequestMiddleware } from "../request_middleware";

import { IContext } from "azure-function-express";

const CONTEXT_IDENTIFIER = "context";

export function setAppContext(app: express.Express, context: IContext<{}>): void {
  app.set(CONTEXT_IDENTIFIER, context);
}

export function getAppContext<T>(request: express.Request): IContext<T> {
  return request.app.get(CONTEXT_IDENTIFIER);
}

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 *
 * TODO: validate that the context is indeed defined, respond with ResponseErrorInternal instead
 */
export function ContextMiddleware<T>(): IRequestMiddleware<never, IContext<T>> {
  return (request: express.Request) => {
    return Promise.resolve(right(getAppContext(request)));
  };
}
