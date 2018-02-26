// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { NotificationChannelStatusValue } from "./NotificationChannelStatusValue";

/**
 *
 */

import * as t from "io-ts";
import { strictInterfaceWithOptionals } from "../../utils/types";

// required attributes
const MessageResponseNotificationStatusR = t.interface({});

// optional attributes
const MessageResponseNotificationStatusO = t.partial({
  email: NotificationChannelStatusValue
});

export const MessageResponseNotificationStatus = strictInterfaceWithOptionals(
  MessageResponseNotificationStatusR.props,
  MessageResponseNotificationStatusO.props,
  "MessageResponseNotificationStatus"
);

export type MessageResponseNotificationStatus = t.TypeOf<
  typeof MessageResponseNotificationStatus
>;
