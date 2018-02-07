// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { CreatedMessageWithoutContent } from "./CreatedMessageWithoutContent";
import { NotificationStatus } from "./NotificationStatus";

/**
 *
 */

import * as t from "io-ts";
import { strictInterfaceWithOptionals } from "../../utils/types";

// required attributes
const MessageResponseWithoutContentR = t.interface({
  message: CreatedMessageWithoutContent
});

// optional attributes
const MessageResponseWithoutContentO = t.partial({
  notification: NotificationStatus
});

export const MessageResponseWithoutContent = strictInterfaceWithOptionals(
  MessageResponseWithoutContentR.props,
  MessageResponseWithoutContentO.props,
  "MessageResponseWithoutContent"
);

export type MessageResponseWithoutContent = t.TypeOf<
  typeof MessageResponseWithoutContent
>;
