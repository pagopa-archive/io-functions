// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * Pagination response parameters.
 */

import { option, Option } from "ts-option";

export interface PaginationResponse {
  readonly page_size?: number;

  readonly next?: string;
}

export function isPaginationResponse(arg: any): arg is PaginationResponse {
  return (
    arg &&
    typeof arg.page_size === "number" &&
    typeof arg.next === "string" &&
    true
  );
}

export function toPaginationResponse(arg: any): Option<PaginationResponse> {
  return option(arg).filter(isPaginationResponse);
}
