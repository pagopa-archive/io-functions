import { IRequestMiddleware } from "../request_middleware";

import { IContext, IRequestWithContext } from "azure-function-express-cloudify";

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export function ContextMiddleware<T>(): IRequestMiddleware<IContext<T>> {
  return (request: IRequestWithContext<T>, __) => {
    return Promise.resolve(request.context);
  };
}
