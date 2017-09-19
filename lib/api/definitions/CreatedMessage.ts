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

/**
 * 
 */

import { option, Option } from "ts-option";

export interface CreatedMessage {
  readonly id?: string;

  readonly fiscal_code: FiscalCode;

  readonly time_to_live?: TimeToLive;

  readonly content: MessageContent;

  readonly sender_organization_id: string;
}

export function isCreatedMessage(arg: any): arg is CreatedMessage {
  return (
    arg &&
    (arg.id === undefined || arg.id === null || typeof arg.id === "string") &&
    isFiscalCode(arg.fiscal_code) &&
    (arg.time_to_live === undefined ||
      arg.time_to_live === null ||
      isTimeToLive(arg.time_to_live)) &&
    isMessageContent(arg.content) &&
    typeof arg.sender_organization_id === "string" &&
    true
  );
}

export function toCreatedMessage(arg: any): Option<CreatedMessage> {
  return option(arg).filter(isCreatedMessage);
}
