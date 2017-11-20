// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import {
  isNotificationChannelStatus,
  NotificationChannelStatus
} from "./NotificationChannelStatus";

/**
 * 
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface NotificationStatus {
  readonly email?: NotificationChannelStatus;
}

export function isNotificationStatus(arg: any): arg is NotificationStatus {
  return (
    arg &&
    (arg.email === undefined ||
      arg.email === null ||
      isNotificationChannelStatus(arg.email)) &&
    true
  );
}

export function toNotificationStatus(arg: any): Option<NotificationStatus> {
  return fromNullable(arg).filter(isNotificationStatus);
}
