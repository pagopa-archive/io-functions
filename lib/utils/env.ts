import { isLeft } from "fp-ts/lib/Either";
import { NonEmptyString } from "io-ts-commons/lib/strings";

/**
 * Helper function that validates an environment variable and return its value
 * if it's a `NonEmptyString`.
 * Throws an Error otherwise.
 */
export function getRequiredStringEnv(k: string): NonEmptyString {
  const maybeValue = NonEmptyString.decode(process.env[k]);

  if (isLeft(maybeValue)) {
    throw new Error(`${k} must be defined and non-empty`);
  }

  return maybeValue.value;
}
