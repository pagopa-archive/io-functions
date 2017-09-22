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

/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */
export interface ICreatedMessageEvent {
  readonly messageContent: IMessageContent;
  readonly message: IRetrievedMessageWithoutContent;
  readonly defaultAddresses?: NewMessageDefaultAddresses;
}

/**
 * Type guard for ICreatedMessageEvent objects
 */
export const isICreatedMessageEvent = is<ICreatedMessageEvent>(
  arg =>
    isIRetrievedMessageWithoutContent(arg.message) &&
    isIMessageContent(arg.messageContent) &&
    (!arg.defaultAddresses ||
      isNewMessageDefaultAddresses(arg.defaultAddresses))
);
