import { FiscalCode } from "./fiscalcode";
import { ModelId } from "./versioned_model";

/**
 * Converts a FiscalCode to a ModelId.
 *
 * Note that this is always possible since a valid FiscalCode is
 * also a valid ModelId.
 */
export function fiscalCodeToModelId(o: FiscalCode): ModelId {
  return (o as string) as ModelId;
}
