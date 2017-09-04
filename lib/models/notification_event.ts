/**
 * Payload of a notification event.
 *
 * This event gets triggered on new notifications to the channels that
 * have been configured for that notification.
 */
export interface INotificationEvent {
  readonly messageId: string;
  readonly notificationId: string;
}

/**
 * Type guard for INotificationEvent objects
 */
// tslint:disable-next-line:no-any
export function isNotificationEvent(arg: any): arg is INotificationEvent {
  return typeof arg.notificationId === "string" && arg.notificationId.length > 0 &&
  typeof arg.messageId === "string" && arg.messageId.length > 0;
}
