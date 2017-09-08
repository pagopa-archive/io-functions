import * as express from "express";

import { IResultIterator, iteratorToArray } from "./documentdb";

/**
 * Interface for a Response that can be returned by a middleware or
 * by the handlers.
 */
export interface IResponse {
  readonly kind: string;
  readonly apply: (response: express.Response) => void;
}

//
// Success reponses
//

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
 * A successful response that consumes and return the documentdb iterator as a json array
 */
export function ResponseSuccessJsonIterator<T>(i: IResultIterator<T>): IResponseSuccessJsonIterator<T> {

  return {
    apply: (res) => iteratorToArray(i).then((documents) => {
      const kindlessDocuments = documents.map((d) => Object.assign(Object.assign({}, d), { kind: undefined }));
      res.status(200).json(kindlessDocuments);
    }),
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

//
// Error responses
//

interface IProblemDescription {
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly "type"?: string;
}

/**
 * Interface for a response describing a generic server error.
 */
export interface IResponseErrorGeneric extends IResponse {
  readonly kind: "IResponseErrorGeneric";
}

/**
 * Returns a response describing a generic error.
 *
 * The error is translated to an RFC 7807 response (Problem JSON)
 * See https://zalando.github.io/restful-api-guidelines/index.html#176
 *
 */
export function ResponseErrorGeneric(
  status: number,
  title: string,
  detail: string,
  problemType?: string,
): IResponseErrorGeneric {
  const problem: IProblemDescription = {
    detail,
    status,
    title,
    type: problemType,
  };
  return {
    apply: (res) => res
      .status(status)
      .contentType("application/problem+json")
      .json(problem),
    kind: "IResponseErrorGeneric",
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
 * @param title The error message
 */
export function ResponseErrorNotFound(title: string, detail: string): IResponseErrorNotFound {
  return {
    ...ResponseErrorGeneric(404, title, detail),
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
export function ResponseErrorValidation(title: string, detail: string): IResponseErrorValidation {
  return {
    ...ResponseErrorGeneric(400, title, detail),
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
  ...ResponseErrorGeneric(
    403,
    "You are not allowed here",
    "You do not have enough permission to complete the operation you requested",
  ),
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
  ...ResponseErrorGeneric(
    403,
    "Production call forbidden",
    "You are not allowed to issue production calls, set 'dry_run' to true or ask to be enabled for production.",
  ),
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
  ...ResponseErrorGeneric(
    403,
    "User has no valid scopes",
    "You are not part of any valid scope, you should ask the administrator to give you the required permissions.",
  ),
  kind: "IResponseErrorForbiddenNoAuthorizationGroups",
};
