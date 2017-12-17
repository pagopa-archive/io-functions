// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

/**
 * Describes a single IP or a range of IPs.
 */

import { PatternString } from "../../utils/strings";

import * as t from "io-ts";

export type CIDR = t.TypeOf<typeof CIDR>;

export const CIDR = PatternString(
  "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
);
