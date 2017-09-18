// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isTimeToLive, TimeToLive } from "./TimeToLive";
import { isMessageContent, MessageContent } from "./MessageContent";
import {
  isNewMessageDefaultAddresses,
  NewMessageDefaultAddresses
} from "./NewMessageDefaultAddresses";

/**
 *
 */

import { option, Option } from "ts-option";

export interface NewMessage {
  readonly dry_run?: boolean;

  readonly time_to_live?: TimeToLive;

  readonly content: MessageContent;

  readonly default_addresses?: NewMessageDefaultAddresses;
}

export function isNewMessage(arg: any): arg is NewMessage {
  return (
    arg &&
    (!arg.dry_run || typeof arg.dry_run === "boolean") &&
    (!arg.time_to_live || isTimeToLive(arg.time_to_live)) &&
    isMessageContent(arg.content) &&
    (!arg.default_addresses ||
      isNewMessageDefaultAddresses(arg.default_addresses)) &&
    true
  );
}

export function toNewMessage(arg: any): Option<NewMessage> {
  return option(arg).filter(isNewMessage);
}
