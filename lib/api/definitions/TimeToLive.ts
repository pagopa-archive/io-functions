// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

/**
 * This parameter specifies for how long (in seconds) the system will try to deliver the message to the channels configured by the user.
 */

import { WithinRangeNumber } from "../../utils/numbers";

export type TimeToLive = WithinRangeNumber<3600, 31536000>;

import * as t from "io-ts";

import { withDefault } from "../../utils/default";

const TimeToLiveX = WithinRangeNumber(3600, 31536000);

const defaultValue = t.validate(3600, TimeToLiveX).fold(_ => {
  throw new Error("Invalid default value for TimeToLive");
}, t.identity);

export const TimeToLive = withDefault(TimeToLiveX, defaultValue);
