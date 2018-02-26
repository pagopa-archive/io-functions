// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { NotificationChannel } from "./NotificationChannel";
import { NotificationChannelStatusValue } from "./NotificationChannelStatusValue";
import { Timestamp } from "./Timestamp";

/**
 *
 */

import * as t from "io-ts";
import { strictInterfaceWithOptionals } from "../../utils/types";

// required attributes
const NotificationChannelStatusR = t.interface({
  channel: NotificationChannel,

  status: NotificationChannelStatusValue,

  updateAt: Timestamp
});

// optional attributes
const NotificationChannelStatusO = t.partial({});

export const NotificationChannelStatus = strictInterfaceWithOptionals(
  NotificationChannelStatusR.props,
  NotificationChannelStatusO.props,
  "NotificationChannelStatus"
);

export type NotificationChannelStatus = t.TypeOf<
  typeof NotificationChannelStatus
>;
