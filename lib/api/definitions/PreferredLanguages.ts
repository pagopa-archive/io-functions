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

export enum PreferredLanguagesEnum {
  "it_IT" = "it_IT",

  "en_GB" = "en_GB",

  "es_ES" = "es_ES",

  "de_DE" = "de_DE",

  "fr_FR" = "fr_FR"
}

export type PreferredLanguages = ReadonlyArray<PreferredLanguagesEnum>;

export function isPreferredLanguagesEnum(
  arg: any
): arg is PreferredLanguagesEnum {
  return PreferredLanguagesEnum[arg] !== undefined;
}

export function toPreferredLanguagesEnum(
  arg: any
): Option<PreferredLanguagesEnum> {
  return option(arg).filter(isPreferredLanguagesEnum);
}

export function isPreferredLanguages(arg: any): arg is PreferredLanguages {
  return Array.isArray(arg) && arg.every(e => isPreferredLanguagesEnum(e));
}

export function toPreferredLanguages(arg: any): Option<PreferredLanguages> {
  return option(arg).filter(isPreferredLanguages);
}
