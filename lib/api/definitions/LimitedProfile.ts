// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isPreferredLanguages, PreferredLanguages } from "./PreferredLanguages";

/**
 * Describes the citizen's profile, mostly interesting for preferences attributes.
 */

import { option, Option } from "ts-option";

export interface LimitedProfile {
  readonly preferred_languages?: PreferredLanguages;
}

export function isLimitedProfile(arg: any): arg is LimitedProfile {
  return (
    arg &&
    (arg.preferred_languages === undefined ||
      arg.preferred_languages === null ||
      isPreferredLanguages(arg.preferred_languages)) &&
    true
  );
}

export function toLimitedProfile(arg: any): Option<LimitedProfile> {
  return option(arg).filter(isLimitedProfile);
}
