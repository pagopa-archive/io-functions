// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isCreatedMessage, CreatedMessage } from "./CreatedMessage";
import { isNotificationStatus, NotificationStatus } from "./NotificationStatus";

/**
 * 
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface MessageResponse {
  readonly message: CreatedMessage;

  readonly notification?: NotificationStatus;
}

export function isMessageResponse(arg: any): arg is MessageResponse {
  return (
    arg &&
    isCreatedMessage(arg.message) &&
    (arg.notification === undefined ||
      arg.notification === null ||
      isNotificationStatus(arg.notification)) &&
    true
  );
}

export function toMessageResponse(arg: any): Option<MessageResponse> {
  return fromNullable(arg).filter(isMessageResponse);
}
