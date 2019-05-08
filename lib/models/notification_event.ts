import * as t from "io-ts";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { MessageContent } from "../api/definitions/MessageContent";

import { CreatedMessageEventSenderMetadata } from "./created_message_sender_metadata";
import { NewMessageWithoutContent } from "./message";

/**
 * Payload of a notification event.
 *
 * This event gets triggered on new notifications to the channels that
 * have been configured for that notification.
 */
export const NotificationEvent = t.interface({
  content: MessageContent,
  message: NewMessageWithoutContent,
  notificationId: NonEmptyString,
  senderMetadata: CreatedMessageEventSenderMetadata
});

export type NotificationEvent = t.TypeOf<typeof NotificationEvent>;
