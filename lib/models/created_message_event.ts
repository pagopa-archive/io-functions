import is from "ts-is";

import {
  isNewMessageDefaultAddresses,
  NewMessageDefaultAddresses
} from "../api/definitions/NewMessageDefaultAddresses";

import {
  IMessageContent,
  IRetrievedMessageWithoutContent,
  isIMessageContent,
  isIRetrievedMessageWithoutContent
} from "./message";

import {
  ICreatedMessageEventSenderMetadata,
  isICreatedMessageEventSenderMetadata
} from "./created_message_sender_metadata";

/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */
export interface ICreatedMessageEvent {
  // the optional message, it will be defined only if the message was saved
  readonly message: IRetrievedMessageWithoutContent;
  readonly messageContent: IMessageContent;
  readonly defaultAddresses?: NewMessageDefaultAddresses;
  readonly senderMetadata: ICreatedMessageEventSenderMetadata;
}

/**
 * Type guard for ICreatedMessageEvent objects
 */
export const isICreatedMessageEvent = is<ICreatedMessageEvent>(
  arg =>
    arg.message &&
    isIRetrievedMessageWithoutContent(arg.message) &&
    arg.messageContent &&
    isIMessageContent(arg.messageContent) &&
    arg.senderMetadata &&
    isICreatedMessageEventSenderMetadata(arg.senderMetadata) &&
    (!arg.defaultAddresses ||
      isNewMessageDefaultAddresses(arg.defaultAddresses))
);
