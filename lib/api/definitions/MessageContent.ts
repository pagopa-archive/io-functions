// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name

import { Option } from "ts-option";

import { isBodyShort, BodyShort } from "./BodyShort";
import { isBodyLong, BodyLong } from "./BodyLong";

/**
 * 
 */

import { option } from "ts-option";

export interface MessageContent {
  readonly body_short: BodyShort;

  readonly body_long?: BodyLong;
}

// tslint:disable-next-line:no-any
export function isMessageContent(arg: any): arg is MessageContent {
  return (
    arg && isBodyShort(arg.body_short) && isBodyLong(arg.body_long) && true
  );
}

// tslint:disable-next-line:no-any
export function toMessageContent(arg: any): Option<MessageContent> {
  return option(arg).filter(isMessageContent);
}
