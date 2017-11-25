// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * The name of the service. Will be added to the content of sent messages.
 */

import {
  isNonEmptyString,
  toNonEmptyString,
  NonEmptyString
} from "../../utils/strings";

export type ServiceName = NonEmptyString;

export const isServiceName = isNonEmptyString;

export const toServiceName = toNonEmptyString;
