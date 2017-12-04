// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { PreferredLanguages } from "./PreferredLanguages";

/**
 * Describes the citizen's profile, mostly interesting for preferences attributes.
 */

import * as t from "io-ts";

// required attributes
const LimitedProfileR = t.interface({});

// optional attributes
const LimitedProfileO = t.partial({
  preferred_languages: PreferredLanguages
});

export const LimitedProfile = t.intersection([
  LimitedProfileR,
  LimitedProfileO
]);

export type LimitedProfile = t.TypeOf<typeof LimitedProfile>;
