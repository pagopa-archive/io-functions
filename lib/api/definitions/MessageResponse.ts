// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { CreatedMessage } from "./CreatedMessage";
import { NotificationStatus } from "./NotificationStatus";

/**
 *
 */

import * as t from "io-ts";
import { strictInterfaceWithOptionals } from "../../utils/types";

// required attributes
const MessageResponseR = t.interface({
  message: CreatedMessage
});

// optional attributes
const MessageResponseO = t.partial({
  notification: NotificationStatus
});

export const MessageResponse = strictInterfaceWithOptionals(
  MessageResponseR.props,
  MessageResponseO.props,
  "MessageResponse"
);

export type MessageResponse = t.TypeOf<typeof MessageResponse>;
