import { right } from "../either";

import { IRequestMiddleware } from "../request_middleware";

import { IContext, IRequestWithContext } from "azure-function-express-cloudify";

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 *
 * TODO: validate that the context is indeed defined, respond with ResponseErrorInternal instead
 */
export function ContextMiddleware<T>(): IRequestMiddleware<never, IContext<T>> {
  return (request: IRequestWithContext<T>) => {
    return Promise.resolve(right(request.context));
  };
}
