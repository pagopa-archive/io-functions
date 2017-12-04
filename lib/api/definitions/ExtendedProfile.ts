// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { EmailAddress } from "./EmailAddress";
import { PreferredLanguages } from "./PreferredLanguages";

/**
 * Describes the citizen's profile, mostly interesting for preferences attributes.
 */

import * as t from "io-ts";

// required attributes
const ExtendedProfileR = t.interface({});

// optional attributes
const ExtendedProfileO = t.partial({
  email: EmailAddress,

  preferred_languages: PreferredLanguages,

  version: t.number
});

export const ExtendedProfile = t.intersection([
  ExtendedProfileR,
  ExtendedProfileO
]);

export type ExtendedProfile = t.TypeOf<typeof ExtendedProfile>;
