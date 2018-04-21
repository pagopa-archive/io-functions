import * as t from "io-ts";

import { NonEmptyString } from "italia-ts-commons/dist/lib/strings";

import { CreatedMessageEventSenderMetadata } from "./created_message_sender_metadata";
import { NewMessageWithContent } from "./message";

/**
 * Payload of a notification event.
 *
 * This event gets triggered on new notifications to the channels that
 * have been configured for that notification.
 */
export const NotificationEvent = t.interface({
  message: NewMessageWithContent,
  notificationId: NonEmptyString,
  senderMetadata: CreatedMessageEventSenderMetadata
});

export type NotificationEvent = t.TypeOf<typeof NotificationEvent>;
