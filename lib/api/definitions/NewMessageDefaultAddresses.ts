// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name

import { isEmailAddress, EmailAddress } from "./EmailAddress";


/**
 * Default addresses for notifying the recipient of the message.
 */

import { option, Option } from "ts-option";

export interface NewMessageDefaultAddresses {

  readonly email?: EmailAddress;

}

// tslint:disable-next-line:no-any
export function isNewMessageDefaultAddresses(arg: any): arg is NewMessageDefaultAddresses {
  return arg &&

    isEmailAddress(arg.email) &&
  

    true;
}

// tslint:disable-next-line:no-any
export function toNewMessageDefaultAddresses(arg: any): Option<NewMessageDefaultAddresses> {
  return option(arg).filter(isNewMessageDefaultAddresses);
}


