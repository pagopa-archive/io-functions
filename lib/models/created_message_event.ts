import is from "ts-is";

import {
  isNewMessageDefaultAddresses,
  NewMessageDefaultAddresses
} from "../api/definitions/NewMessageDefaultAddresses";

import { IRetrievedMessage, isIRetrievedMessage } from "./message";

/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */
export interface ICreatedMessageEvent {
  readonly message: IRetrievedMessage;
  readonly defaultAddresses?: NewMessageDefaultAddresses;
}

/**
 * Type guard for ICreatedMessageEvent objects
 */
export const isICreatedMessageEvent = is<ICreatedMessageEvent>(
  arg =>
    isIRetrievedMessage(arg.message) &&
    (!arg.defaultAddresses ||
      isNewMessageDefaultAddresses(arg.defaultAddresses))
);
