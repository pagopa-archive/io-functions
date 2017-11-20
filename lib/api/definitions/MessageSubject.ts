// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * The (optional) subject of the message - note that only some notification
channels support the display of a subject. When a subject is not provided,
one gets generated from the client attributes.
 */

import { Option } from "fp-ts/lib/Option";

import {
  isWithinRangeString,
  toWithinRangeString,
  WithinRangeString
} from "../../utils/strings";

export type MessageSubject = WithinRangeString<10, 120>;

export function isMessageSubject(arg: any): arg is MessageSubject {
  return isWithinRangeString(arg, 10, 120);
}

export function toMessageSubject(arg: any): Option<MessageSubject> {
  return toWithinRangeString(arg, 10, 120);
}
