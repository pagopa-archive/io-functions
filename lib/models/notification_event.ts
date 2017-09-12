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
// tslint:disable-next-line:no-any
export function isNotificationEvent(arg: any): arg is INotificationEvent {
  return arg &&
  isNonEmptyString(arg.notificationId) &&
  isNonEmptyString(arg.messageId);
}
