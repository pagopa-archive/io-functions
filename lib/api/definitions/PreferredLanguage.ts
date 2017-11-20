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

import { fromNullable, Option } from "fp-ts/lib/Option";

export enum PreferredLanguage {
  "it_IT" = "it_IT",

  "en_GB" = "en_GB",

  "es_ES" = "es_ES",

  "de_DE" = "de_DE",

  "fr_FR" = "fr_FR"
}

export function isPreferredLanguage(arg: any): arg is PreferredLanguage {
  return PreferredLanguage[arg] !== undefined;
}

export function toPreferredLanguage(arg: any): Option<PreferredLanguage> {
  return fromNullable(arg).filter(isPreferredLanguage);
}
