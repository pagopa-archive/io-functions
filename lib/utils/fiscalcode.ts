import * as codiceFiscaleItaliano from "codice-fiscale-italiano";

declare class FiscalCodeTag {
  private dummy: boolean;
}

export type FiscalCode = string & FiscalCodeTag;

/**
 * Type guard for strings that represent fiscal codes.
 *
 * @param cf Uppercase fiscal code
 */
export function isFiscalCode(cf: string): cf is FiscalCode {
  return cf.toUpperCase() === cf && codiceFiscaleItaliano.validateCF(cf);
}
