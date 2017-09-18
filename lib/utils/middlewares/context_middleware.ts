import * as express from "express";

import { Option, option } from "ts-option";
import { left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";

import { IResponseErrorInternal, ResponseErrorInternal} from "../response";

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
export function ContextMiddleware<T>(): IRequestMiddleware<IResponseErrorInternal, IContext<T> | void> {
  return (request) => new Promise((resolve) => (
    getAppContext<T>(request)
      .match({
        none: () => resolve(left(ResponseErrorInternal("Cannot get context from request"))),
        some: (context) => resolve(right(context)),
      })
    ));
}
