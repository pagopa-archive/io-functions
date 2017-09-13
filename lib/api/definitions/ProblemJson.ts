// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name

import { Option } from "ts-option";

import { isHttpStatusCode, HttpStatusCode } from "./HttpStatusCode";


/**
 * 
 */

import { option } from "ts-option";

export interface ProblemJson {

  readonly type?: string;

  readonly title?: string;

  readonly status?: HttpStatusCode;

  readonly detail?: string;

  readonly instance?: string;

}

// tslint:disable-next-line:no-any
export function isProblemJson(arg: any): arg is ProblemJson {
  return arg &&

    typeof arg.type === "string" &&
  

    typeof arg.title === "string" &&
  

    isHttpStatusCode(arg.status) &&
  

    typeof arg.detail === "string" &&
  

    typeof arg.instance === "string" &&
  

    true;
}

// tslint:disable-next-line:no-any
export function toProblemJson(arg: any): Option<ProblemJson> {
  return option(arg).filter(isProblemJson);
}


