// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

/**
 *
 */

import { enumType } from "../../utils/types";

export enum MessageStatusEnum {
  "ACCEPTED" = "ACCEPTED",

  "FAILED" = "FAILED",

  "THROTTLED" = "THROTTLED"
}

import * as t from "io-ts";

export type MessageStatus = t.TypeOf<typeof MessageStatus>;

export const MessageStatus = enumType<MessageStatusEnum>(
  MessageStatusEnum,
  "MessageStatus"
);
