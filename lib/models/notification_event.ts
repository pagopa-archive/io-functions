import is from "ts-is";

import { isNonEmptyString, NonEmptyString } from "../utils/strings";

/**
 * Payload of a notification event.
 *
 * This event gets triggered on new notifications to the channels that
 * have been configured for that notification.
 */
export interface INotificationEvent {
  readonly messageId: NonEmptyString;
  readonly notificationId: NonEmptyString;
}

/**
 * Type guard for INotificationEvent objects
 */
export const isNotificationEvent = is<INotificationEvent>(
  arg =>
    arg &&
    isNonEmptyString(arg.notificationId) &&
    isNonEmptyString(arg.messageId)
);
