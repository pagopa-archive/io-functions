// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { NotificationChannelStatus } from "./NotificationChannelStatus";

/**
 * 
 */

import * as t from "io-ts";

// required attributes
const NotificationStatusR = t.interface({});

// optional attributes
const NotificationStatusO = t.partial({
  email: NotificationChannelStatus
});

export const NotificationStatus = t.intersection([
  NotificationStatusR,
  NotificationStatusO
]);

export type NotificationStatus = t.TypeOf<typeof NotificationStatus>;
