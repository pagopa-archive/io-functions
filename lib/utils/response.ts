import * as express from "express";

import { IResultIterator } from "./documentdb";

/**
 * Interface for a Response that can be returned by a middleware or
 * by the handlers.
 */
export interface IResponse {
  readonly kind: string;
  readonly apply: (response: express.Response) => void;
}

/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJson<T> extends IResponse {
  readonly kind: "IResponseSuccessJson";
  readonly value: T; // needed to discriminate from other T subtypes
}

/**
 * Returns a successful json response.
 *
 * @param o The object to return to the client
 */
export function ResponseSuccessJson<T>(o: T): IResponseSuccessJson<T> {
  const kindlessObject = Object.assign(Object.assign({}, o), { kind: undefined });
  return {
    apply: (res) => res.status(200).json(kindlessObject),
    kind: "IResponseSuccessJson",
    value: o,
  };
}

/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJsonIterator<T> extends IResponse {
  readonly kind: "IResponseSuccessJsonIterator";
  readonly value: T; // needed to discriminate from other T subtypes
}

/**
 * A successful response that streams the documentdb iterator as a json array
 */
export function ResponseSuccessJsonIterator<T>(i: IResultIterator<T>): IResponseSuccessJsonIterator<T> {

  function sendResponseOpen(res: express.Response): void {
    res.status(200).type("application/json").send("[");
  }

  function sendResponseClose(res: express.Response): void {
    res.send("{}]").end();
  }

  function streamResponse(res: express.Response): void {
    i.executeNext().then(
      (result) => {
        if (Array.isArray(result) && result.length > 0) {
          result.forEach((r) => {
            res.send(`${JSON.stringify(r)},`);
          });
          streamResponse(res);
        } else {
          sendResponseClose(res);
        }
      },
      (_) => {
        sendResponseClose(res);
      },
    );
  }
  return {
    apply: (res) => {
      sendResponseOpen(res);
      streamResponse(res);
    },
    kind: "IResponseSuccessJsonIterator",
    value: {} as T,
  };
}

/**
 * Interface for a successful response returning a redirect to a resource.
 */
export interface IResponseSuccessRedirectToResource<T> extends IResponse {
  readonly kind: "IResponseSuccessRedirectToResource";
  readonly resource: T; // type checks the right kind of resource
}

/**
 * Returns a successful response returning a redirect to a resource.
 */
export function ResponseSuccessRedirectToResource<T>(resource: T, url: string): IResponseSuccessRedirectToResource<T> {
  return {
    apply: (res) => res.redirect(202, url),
    kind: "IResponseSuccessRedirectToResource",
    resource,
  };
}

/**
 * Interface for a response describing a 404 error.
 */
export interface IResponseErrorNotFound extends IResponse {
  readonly kind: "IResponseErrorNotFound";
}

/**
 * Returns a response describing a 404 error.
 *
 * @param message The error message
 */
export function ResponseErrorNotFound(message: string): IResponseErrorNotFound {
  return {
    apply: (res) => res.status(404).json({
      error: message,
    }),
    kind: "IResponseErrorNotFound",
  };
}

/**
 * Interface for a response describing a validation error.
 */
export interface IResponseErrorValidation extends IResponse {
  readonly kind: "IResponseErrorValidation";
}

/**
 * Returns a response describing a validation error.
 *
 * @param message The error message
 */
export function ResponseErrorValidation(message: string): IResponseErrorValidation {
  return {
    apply: (res) => res.status(400).json({
      error: message,
    }),
    kind: "IResponseErrorValidation",
  };
}

/**
 * The user is not allowed here.
 */
export interface IResponseErrorForbiddenNotAuthorized extends IResponse {
  readonly kind: "IResponseErrorForbiddenNotAuthorized";
}

/**
 * The user is not allowed here.
 */
export const ResponseErrorForbiddenNotAuthorized: IResponseErrorForbiddenNotAuthorized = {
  apply: (res) => res.status(403).json({
    error: "You are not allowed here",
  }),
  kind: "IResponseErrorForbiddenNotAuthorized",
};

/**
 * The user is not allowed here.
 */
export interface IResponseErrorForbiddenNotAuthorizedForProduction extends IResponse {
  readonly kind: "IResponseErrorForbiddenNotAuthorizedForProduction";
}

/**
 * The user is not allowed here.
 */
export const ResponseErrorForbiddenNotAuthorizedForProduction: IResponseErrorForbiddenNotAuthorizedForProduction = {
  apply: (res) => res.status(403).json({
    error: "You are not allowed to issue production calls, set 'dry_run' to true.",
  }),
  kind: "IResponseErrorForbiddenNotAuthorizedForProduction",
};

/**
 * The user is not part of any valid authorization groups.
 */
export interface IResponseErrorForbiddenNoAuthorizationGroups extends IResponse {
  readonly kind: "IResponseErrorForbiddenNoAuthorizationGroups";
}

/**
 * The user is not part of any valid authorization groups.
 */
export const ResponseErrorForbiddenNoAuthorizationGroups: IResponseErrorForbiddenNoAuthorizationGroups = {
  apply: (res) => res.status(403).json({
    error: "You are not part of any valid authorization groups",
  }),
  kind: "IResponseErrorForbiddenNoAuthorizationGroups",
};

/**
 * Interface for a response describing a generic server error.
 */
export interface IResponseErrorGeneric extends IResponse {
  readonly kind: "IResponseErrorGeneric";
}

/**
 * Returns a response describing a generic error.
 *
 * @param message The error message
 */
export function ResponseErrorGeneric(message: string): IResponseErrorGeneric {
  return {
    apply: (res) => res.status(500).json({
      error: message,
    }),
    kind: "IResponseErrorGeneric",
  };
}
