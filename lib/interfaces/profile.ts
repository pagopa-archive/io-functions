import { FiscalCode } from "../utils/fiscalcode";

/**
 * Interface for Profile objects
 */
export interface IProfile {
  fiscalCode: FiscalCode;
  email?: string;
}
