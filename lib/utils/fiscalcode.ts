import { none, Option, some } from "ts-option";

import * as codiceFiscaleItaliano from "codice-fiscale-italiano";

declare class FiscalCodeTag {
  private kind: "FiscalCodeTag";
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

/**
 * Returns a defined option if the provided string is a valid fiscal code.
 *
 * @param cf A string representing a Fiscal Code
 */
export function toFiscalCode(cf: string): Option<FiscalCode> {
  if (isFiscalCode(cf)) {
    return some(cf);
  } else {
    return none;
  }
}
