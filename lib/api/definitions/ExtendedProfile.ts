// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isEmailAddress, EmailAddress } from "./EmailAddress";
import { isPreferredLanguages, PreferredLanguages } from "./PreferredLanguages";

/**
 * Describes the citizen's profile, mostly interesting for preferences attributes.
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface ExtendedProfile {
  readonly email?: EmailAddress;

  readonly preferred_languages?: PreferredLanguages;

  readonly version?: number;
}

export function isExtendedProfile(arg: any): arg is ExtendedProfile {
  return (
    arg &&
    (arg.email === undefined ||
      arg.email === null ||
      isEmailAddress(arg.email)) &&
    (arg.preferred_languages === undefined ||
      arg.preferred_languages === null ||
      isPreferredLanguages(arg.preferred_languages)) &&
    (arg.version === undefined ||
      arg.version === null ||
      typeof arg.version === "number") &&
    true
  );
}

export function toExtendedProfile(arg: any): Option<ExtendedProfile> {
  return fromNullable(arg).filter(isExtendedProfile);
}
