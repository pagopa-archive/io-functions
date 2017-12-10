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

import * as t from "io-ts";

import { enumType } from "../../utils/types";

export enum NotificationChannelStatusEnum {
  "QUEUED" = "QUEUED",

  "SENT_TO_CHANNEL" = "SENT_TO_CHANNEL"
}

export const NotificationChannelStatus = enumType<
  NotificationChannelStatusEnum
>(NotificationChannelStatusEnum, "NotificationChannelStatus");

export type NotificationChannelStatus = t.TypeOf<
  typeof NotificationChannelStatus
>;
