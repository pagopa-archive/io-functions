// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * 
 */

import { option, Option } from "ts-option";

export interface CreatedMessageResponse {
  readonly dry_run: boolean;
}

export function isCreatedMessageResponse(
  arg: any
): arg is CreatedMessageResponse {
  return arg && typeof arg.dry_run === "boolean" && true;
}

export function toCreatedMessageResponse(
  arg: any
): Option<CreatedMessageResponse> {
  return option(arg).filter(isCreatedMessageResponse);
}
