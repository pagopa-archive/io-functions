import { right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
// import { IResponse } from "../response";

import { IContext, IRequestWithContext } from "azure-function-express";

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export function ContextMiddleware<T>(): IRequestMiddleware<never, IContext<T>> {
  return (request: IRequestWithContext<T>) => {
    return Promise.resolve(right(request.app.get("context")));
  };
}
