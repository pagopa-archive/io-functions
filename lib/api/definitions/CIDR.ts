// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * Describes a single IP or a range of IPs.
 */

import { Option } from "fp-ts/lib/Option";

import {
  isPatternString,
  toPatternString,
  PatternString
} from "../../utils/strings";

export type CIDR = PatternString<
  "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
>;

export function isCIDR(arg: any): arg is CIDR {
  return isPatternString(
    arg,
    "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
  );
}

export function toCIDR(arg: any): Option<CIDR> {
  return toPatternString(
    arg,
    "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
  );
}
