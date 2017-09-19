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

import { isPreferredLanguage, PreferredLanguage } from "./PreferredLanguage";

export type PreferredLanguages = ReadonlyArray<PreferredLanguage>;

export function isPreferredLanguages(arg: any): arg is PreferredLanguages {
  return Array.isArray(arg) && arg.every(e => isPreferredLanguage(e));
}

export function toPreferredLanguages(arg: any): Option<PreferredLanguages> {
  return option(arg).filter(isPreferredLanguages);
}
