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

export enum NotificationChannelStatusValueEnum {
  "QUEUED" = "QUEUED",

  "SENT_TO_CHANNEL" = "SENT_TO_CHANNEL",

  "EXPIRED" = "EXPIRED",

  "FAILED" = "FAILED"
}

import * as t from "io-ts";

export type NotificationChannelStatusValue = t.TypeOf<
  typeof NotificationChannelStatusValue
>;

export const NotificationChannelStatusValue = enumType<
  NotificationChannelStatusValueEnum
>(NotificationChannelStatusValueEnum, "NotificationChannelStatusValue");
