// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isFiscalCode, FiscalCode } from "./FiscalCode";
import { isTimeToLive, TimeToLive } from "./TimeToLive";
import { isMessageContent, MessageContent } from "./MessageContent";
import { isMessageStatus, MessageStatus } from "./MessageStatus";

/**
 * 
 */

import { option, Option } from "ts-option";

export interface CreatedMessage {
  readonly id: string;

  readonly fiscal_code: FiscalCode;

  readonly time_to_live: TimeToLive;

  readonly content: MessageContent;

  readonly status: MessageStatus;
}

// tslint:disable-next-line:no-any
export function isCreatedMessage(arg: any): arg is CreatedMessage {
  return (
    arg &&
    typeof arg.id === "string" &&
    isFiscalCode(arg.fiscal_code) &&
    isTimeToLive(arg.time_to_live) &&
    isMessageContent(arg.content) &&
    isMessageStatus(arg.status) &&
    true
  );
}

// tslint:disable-next-line:no-any
export function toCreatedMessage(arg: any): Option<CreatedMessage> {
  return option(arg).filter(isCreatedMessage);
}
