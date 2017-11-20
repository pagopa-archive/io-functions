// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * Indicates the User's preferred written or spoken languages in order of preference. Generally used for selecting a localized User interface. Valid values are concatenation of the ISO 639-1 two letter language code, an underscore, and the ISO 3166-1 2 letter country code; e.g., 'en_US' specifies the language English and country US.
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

import { isPreferredLanguage, PreferredLanguage } from "./PreferredLanguage";

export type PreferredLanguages = ReadonlyArray<PreferredLanguage>;

export function isPreferredLanguages(arg: any): arg is PreferredLanguages {
  return Array.isArray(arg) && arg.every(e => isPreferredLanguage(e));
}

export function toPreferredLanguages(arg: any): Option<PreferredLanguages> {
  return fromNullable(arg).filter(isPreferredLanguages);
}
