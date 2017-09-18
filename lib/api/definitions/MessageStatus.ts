// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

/**
 * 
 */

import { option, Option } from "ts-option";

export interface MessageStatus {
  readonly created_at?: string;

  readonly read_at?: string;
}

export function isMessageStatus(arg: any): arg is MessageStatus {
  return (
    arg &&
    typeof arg.created_at === "string" &&
    typeof arg.read_at === "string" &&
    true
  );
}

export function toMessageStatus(arg: any): Option<MessageStatus> {
  return option(arg).filter(isMessageStatus);
}
