import { FiscalCode } from "../utils/fiscalcode";

/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */
export interface ICreatedMessageEvent {
  fiscalCode?: FiscalCode;
  messageId?: string;
}
