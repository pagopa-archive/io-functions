// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isEmailAddress, EmailAddress } from "./EmailAddress";

/**
 * Default addresses for notifying the recipient of the message.
 */

import { option, Option } from "ts-option";

export interface NewMessageDefaultAddresses {
  readonly email?: EmailAddress;
}

export function isNewMessageDefaultAddresses(
  arg: any
): arg is NewMessageDefaultAddresses {
  return arg && (!arg.email || isEmailAddress(arg.email)) && true;
}

export function toNewMessageDefaultAddresses(
  arg: any
): Option<NewMessageDefaultAddresses> {
  return option(arg).filter(isNewMessageDefaultAddresses);
}
