// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * The organizazione that runs the service. Will be added to the content of sent messages to identify the sender.
 */

import {
  isNonEmptyString,
  toNonEmptyString,
  NonEmptyString
} from "../../utils/strings";

export type OrganizationName = NonEmptyString;

export const isOrganizationName = isNonEmptyString;

export const toOrganizationName = toNonEmptyString;
