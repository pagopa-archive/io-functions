import { IRetrievedMessage, isIRetrievedMessage } from "./message";

/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */
export interface ICreatedMessageEvent {
  readonly message: IRetrievedMessage;
}

/**
 * Type guard for ICreatedMessageEvent objects
 */
export function isICreatedMessageEvent(arg: any): arg is ICreatedMessageEvent {
  return isIRetrievedMessage(arg.message);
}
