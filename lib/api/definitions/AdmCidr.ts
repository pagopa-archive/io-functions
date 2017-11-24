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

export type AdmCidr = PatternString<
  "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
>;

export function isAdmCidr(arg: any): arg is AdmCidr {
  return isPatternString(
    arg,
    "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
  );
}

export function toAdmCidr(arg: any): Option<AdmCidr> {
  return toPatternString(
    arg,
    "([0-9]{1,3}.){3}[0-9]{1,3}(/([0-9]|[1-2][0-9]|3[0-2]))?"
  );
}
