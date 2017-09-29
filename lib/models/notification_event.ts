import is from "ts-is";

import { isNonEmptyString, NonEmptyString } from "../utils/strings";

import { IMessageContent, isIMessageContent } from "./message";

import {
  ICreatedMessageEventSenderMetadata,
  isICreatedMessageEventSenderMetadata
} from "./created_message_sender_metadata";

/**
 * Payload of a notification event.
 *
 * This event gets triggered on new notifications to the channels that
 * have been configured for that notification.
 */
export interface INotificationEvent {
  readonly messageId: NonEmptyString;
  readonly messageContent: IMessageContent;
  readonly notificationId: NonEmptyString;
  readonly senderMetadata: ICreatedMessageEventSenderMetadata;
}

/**
 * Type guard for INotificationEvent objects
 */
export const isNotificationEvent = is<INotificationEvent>(
  arg =>
    arg &&
    arg.notificationId &&
    isNonEmptyString(arg.notificationId) &&
    arg.messageId &&
    isNonEmptyString(arg.messageId) &&
    arg.messageContent &&
    isIMessageContent(arg.messageContent) &&
    arg.senderMetadata &&
    isICreatedMessageEventSenderMetadata(arg.senderMetadata)
);
