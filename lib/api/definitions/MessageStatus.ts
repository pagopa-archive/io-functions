// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { MessageStatusValue } from "./MessageStatusValue";
import { Timestamp } from "./Timestamp";

/**
 *
 */

import * as t from "io-ts";
import { strictInterfaceWithOptionals } from "../../utils/types";

// required attributes
const MessageStatusR = t.interface({});

// optional attributes
const MessageStatusO = t.partial({
  status: MessageStatusValue,

  updateAt: Timestamp
});

export const MessageStatus = strictInterfaceWithOptionals(
  MessageStatusR.props,
  MessageStatusO.props,
  "MessageStatus"
);

export type MessageStatus = t.TypeOf<typeof MessageStatus>;
