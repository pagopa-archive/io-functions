import { FiscalCode } from "../utils/fiscalcode";

/**
 * Interface for Profile objects
 */
export interface IMessage {
  fiscalCode: FiscalCode;
  bodyShort: string;
}
