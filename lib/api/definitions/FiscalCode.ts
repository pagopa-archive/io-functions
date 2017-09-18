// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name



/**
 * User's fiscal code.
 */

  
import { Option } from "ts-option";

import { isPatternString, toPatternString, PatternString } from "../../utils/strings";

export type FiscalCode = PatternString<"^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$">;

// tslint:disable-next-line:no-any
export function isFiscalCode(arg: any): arg is FiscalCode {
  return isPatternString(arg, "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$");
}

// tslint:disable-next-line:no-any
export function toFiscalCode(arg: any): Option<FiscalCode> {
  return toPatternString(arg, "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$");
}
  

