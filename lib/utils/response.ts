import * as express from "express";

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
  return {
    apply: (res) => res.status(200).json(o),
    kind: "IResponseSuccessJson",
    value: o,
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
 * Interface for a response describing an authorization error.
 */
export interface IResponseErrorForbidden extends IResponse {
  readonly kind: "IResponseErrorForbidden";
}

/**
 * Returns a response describing an authorization error.
 *
 * @param message The error message
 */
export function ResponseErrorForbidden(message: string): IResponseErrorForbidden {
  return {
    apply: (res) => res.status(403).json({
      error: message,
    }),
    kind: "IResponseErrorForbidden",
  };
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
