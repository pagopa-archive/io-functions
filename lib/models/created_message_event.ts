/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */

import * as t from "io-ts";

import { MessageContent } from "../api/definitions/MessageContent";
import { NewMessageDefaultAddresses } from "../api/definitions/NewMessageDefaultAddresses";

import { NewMessageWithoutContent } from "./message";

import { CreatedMessageEventSenderMetadata } from "./created_message_sender_metadata";

const CreatedMessageEventR = t.interface({
  message: NewMessageWithoutContent,
  messageContent: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
});

const CreatedMessageEventO = t.partial({
  defaultAddresses: NewMessageDefaultAddresses
});

export const CreatedMessageEvent = t.intersection(
  [CreatedMessageEventR, CreatedMessageEventO],
  "CreatedMessageEvent"
);

export type CreatedMessageEvent = t.TypeOf<typeof CreatedMessageEvent>;
