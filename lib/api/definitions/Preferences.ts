// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isFiscalCode, FiscalCode } from "./FiscalCode";
import { isEmailAddress, EmailAddress } from "./EmailAddress";
import { isPreferredLanguages, PreferredLanguages } from "./PreferredLanguages";

/**
 * Describes the user's preferences .
 */

import { option, Option } from "ts-option";

export interface Preferences {
  readonly fiscal_code: FiscalCode;

  readonly email?: EmailAddress;

  readonly preferred_languages?: PreferredLanguages;
}

export function isPreferences(arg: any): arg is Preferences {
  return (
    arg &&
    isFiscalCode(arg.fiscal_code) &&
    (arg.email === undefined ||
      arg.email === null ||
      isEmailAddress(arg.email)) &&
    (arg.preferred_languages === undefined ||
      arg.preferred_languages === null ||
      isPreferredLanguages(arg.preferred_languages)) &&
    true
  );
}

export function toPreferences(arg: any): Option<Preferences> {
  return option(arg).filter(isPreferences);
}
