import * as express from "express";

import { Option } from "ts-option";

import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param f       A function that should extract the required parameter from
 *                the params object.
 */
export function RequiredParamMiddleware<T>(
  // tslint:disable-next-line:no-any
  f: (params: any, response: express.Response) => Option<T>,
): IRequestMiddleware<T> {
  return ((request, response) => {
    const v = f(request.params, response);
    if (v.isDefined) {
      return Promise.resolve(v.get);
    } else {
      return Promise.reject(null);
    }
  });
}
