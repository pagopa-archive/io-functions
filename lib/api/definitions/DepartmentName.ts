// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * The departmenet inside the organization that runs the service. Will be added to the content of sent messages.
 */

import {
  isNonEmptyString,
  toNonEmptyString,
  NonEmptyString
} from "../../utils/strings";

export type DepartmentName = NonEmptyString;

export const isDepartmentName = isNonEmptyString;

export const toDepartmentName = toNonEmptyString;
