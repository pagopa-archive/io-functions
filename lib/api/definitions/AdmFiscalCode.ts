// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * An authorized Fiscal Code.
 */

import { Option } from "fp-ts/lib/Option";

import {
  isPatternString,
  toPatternString,
  PatternString
} from "../../utils/strings";

export type AdmFiscalCode = PatternString<
  "[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]"
>;

export function isAdmFiscalCode(arg: any): arg is AdmFiscalCode {
  return isPatternString(
    arg,
    "[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]"
  );
}

export function toAdmFiscalCode(arg: any): Option<AdmFiscalCode> {
  return toPatternString(
    arg,
    "[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]"
  );
}
