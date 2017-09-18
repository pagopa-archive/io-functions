// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * A long version of the message, in plain text. The content of this field will be delivered to channels that don't have any limit in terms of content size (e.g. email, etc...). The long version of the message is optional and should be provided only in cases when a longer message (compared to the short version provided in body_short) gives more information to the user. This field should not be a duplicate of body_short.
 */

import { Option } from "ts-option";

import {
  isWithinRangeString,
  toWithinRangeString,
  WithinRangeString
} from "../../utils/strings";

export type BodyLong = WithinRangeString<100, 100000>;

// tslint:disable-next-line:no-any
export function isBodyLong(arg: any): arg is BodyLong {
  return isWithinRangeString(arg, 100, 100000);
}

// tslint:disable-next-line:no-any
export function toBodyLong(arg: any): Option<BodyLong> {
  return toWithinRangeString(arg, 100, 100000);
}
