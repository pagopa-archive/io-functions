// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * The full version of the message, in plain text or Markdown format. The
content of this field will be delivered to channels that don't have any
limit in terms of content size (e.g. email, etc...).
 */

import { Option } from "fp-ts/lib/Option";

import {
  isWithinRangeString,
  toWithinRangeString,
  WithinRangeString
} from "../../utils/strings";

export type MessageBodyMarkdown = WithinRangeString<80, 10000>;

export function isMessageBodyMarkdown(arg: any): arg is MessageBodyMarkdown {
  return isWithinRangeString(arg, 80, 10000);
}

export function toMessageBodyMarkdown(arg: any): Option<MessageBodyMarkdown> {
  return toWithinRangeString(arg, 80, 10000);
}
