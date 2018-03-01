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

export enum NotificationChannelEnum {
  "EMAIL" = "EMAIL"
}

import * as t from "io-ts";

export type NotificationChannel = t.TypeOf<typeof NotificationChannel>;

export const NotificationChannel = enumType<NotificationChannelEnum>(
  NotificationChannelEnum,
  "NotificationChannel"
);
