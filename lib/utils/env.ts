import * as t from "io-ts";

import { isNone } from "fp-ts/lib/Option";
import { NonEmptyString } from "./strings";

/**
 * Helper function that validates an environment variable and return its value
 * if it's a `NonEmptyString`.
 * Throws an Error otherwise.
 */
export function getRequiredStringEnv(k: string): NonEmptyString {
  const maybeValue = t.validate(process.env[k], NonEmptyString).toOption();

  if (isNone(maybeValue)) {
    throw new Error(`${k} must be defined and non-empty`);
  }

  return maybeValue.value;
}
