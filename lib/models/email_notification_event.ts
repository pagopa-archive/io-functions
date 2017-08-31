import { IMessage, isIMessage } from "./message";

/**
 * Payload of an email notification event.
 *
 * This event gets triggered on new email notifications.
 */
export interface IEmailNotificationEvent {
  readonly message: IMessage;
  readonly recipients: ReadonlyArray<string>;
}

/**
 * Type guard for IEmailNotificationEvent objects
 */
// tslint:disable-next-line:no-any
export function isIEmailNotificationEvent(arg: any): arg is IEmailNotificationEvent {
  return isIMessage(arg.message) &&
    Array.isArray(arg.recipients);
}
