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

export enum NotificationChannelStatus {
  "QUEUED" = "QUEUED",

  "SENT_TO_CHANNEL" = "SENT_TO_CHANNEL"
}

export function isNotificationChannelStatus(
  arg: any
): arg is NotificationChannelStatus {
  return NotificationChannelStatus[arg] !== undefined;
}

export function toNotificationChannelStatus(
  arg: any
): Option<NotificationChannelStatus> {
  return option(arg).filter(isNotificationChannelStatus);
}
