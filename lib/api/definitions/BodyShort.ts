// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name

import { Option } from "ts-option";



/**
 * An abstract of the message, in plain text. The content of this field will be delivered to channels that support a limited amount of characters (e.g. SMS, mobile notifications, etc...).
The caller should assume that only the content in "body_short" may be delivered so the value of this field MUST contain *all* the required information.
 */

  
import { isWithinRangeString, toWithinRangeString, WithinRangeString } from "../../utils/strings";

export type BodyShort = WithinRangeString<3, 100>;

// tslint:disable-next-line:no-any
export function isBodyShort(arg: any): arg is BodyShort {
  return isWithinRangeString(arg, 3, 100);
}

// tslint:disable-next-line:no-any
export function toBodyShort(arg: any): Option<BodyShort> {
  return toWithinRangeString(arg, 3, 100);
}
  

