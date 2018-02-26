// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

/**
 * A date-time field in ISO-8601 format
 */

import { DateFromString } from "../../utils/types";

import * as t from "io-ts";

export type Timestamp = t.TypeOf<typeof Timestamp>;

export const Timestamp = DateFromString;
