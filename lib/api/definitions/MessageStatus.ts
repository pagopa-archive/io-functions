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
    (arg.created_at === undefined ||
      arg.created_at === null ||
      typeof arg.created_at === "string") &&
    (arg.read_at === undefined ||
      arg.read_at === null ||
      typeof arg.read_at === "string") &&
    true
  );
}

export function toMessageStatus(arg: any): Option<MessageStatus> {
  return option(arg).filter(isMessageStatus);
}
