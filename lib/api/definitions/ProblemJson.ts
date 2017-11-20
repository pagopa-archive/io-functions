// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isHttpStatusCode, HttpStatusCode } from "./HttpStatusCode";

/**
 * 
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface ProblemJson {
  readonly type?: string;

  readonly title?: string;

  readonly status?: HttpStatusCode;

  readonly detail?: string;

  readonly instance?: string;
}

export function isProblemJson(arg: any): arg is ProblemJson {
  return (
    arg &&
    (arg.type === undefined ||
      arg.type === null ||
      typeof arg.type === "string") &&
    (arg.title === undefined ||
      arg.title === null ||
      typeof arg.title === "string") &&
    (arg.status === undefined ||
      arg.status === null ||
      isHttpStatusCode(arg.status)) &&
    (arg.detail === undefined ||
      arg.detail === null ||
      typeof arg.detail === "string") &&
    (arg.instance === undefined ||
      arg.instance === null ||
      typeof arg.instance === "string") &&
    true
  );
}

export function toProblemJson(arg: any): Option<ProblemJson> {
  return fromNullable(arg).filter(isProblemJson);
}
