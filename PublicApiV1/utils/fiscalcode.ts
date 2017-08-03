import * as codiceFiscaleItaliano from "codice-fiscale-italiano";

/**
 * Validates the provided fiscal code.
 *
 * @param cf Uppercase fiscal code
 */
export function validateFiscalCode(cf: string): boolean {
  return cf.toUpperCase() === cf && codiceFiscaleItaliano.validateCF(cf);
}
