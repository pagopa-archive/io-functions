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

export enum MessageStatusValueEnum {
  "PROCESSING" = "PROCESSING",

  "ACCEPTED" = "ACCEPTED",

  "FAILED" = "FAILED"
}

import * as t from "io-ts";

export type MessageStatusValue = t.TypeOf<typeof MessageStatusValue>;

export const MessageStatusValue = enumType<MessageStatusValueEnum>(
  MessageStatusValueEnum,
  "MessageStatusValue"
);
