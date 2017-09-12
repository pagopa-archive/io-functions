import is from "ts-is";

import { none, Option, some } from "ts-option";

/**
 * A tagged unboxed type that is a non-empty string
 */

interface INonEmptyStringTag {
  readonly kind: "INonEmptyStringTag";
}

export type NonEmptyString = string & INonEmptyStringTag;

export const isNonEmptyString = is<NonEmptyString>((s) =>
  typeof s === "string" &&
  s.length > 0,
);

export function toNonEmptyString(s: string): Option<NonEmptyString> {
  return isNonEmptyString(s) ? some(s) : none;
}
