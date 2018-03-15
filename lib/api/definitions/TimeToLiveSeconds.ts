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

import * as t from "io-ts";

import { withDefault } from "../../utils/default";

export type TimeToLiveSeconds = t.TypeOf<typeof TimeToLiveSecondsBase>;

const TimeToLiveSecondsBase = WithinRangeNumber(3600, 604800);

export const TimeToLiveSeconds = withDefault(
  TimeToLiveSecondsBase,
  3600 as TimeToLiveSeconds
);
