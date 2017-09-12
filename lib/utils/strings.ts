
import { none, Option, some } from "ts-option";

/**
 * A tagged unboxed type that is a non-empty string
 */

interface INonEmptyStringTag {
  readonly kind: "INonEmptyStringTag";
}

export type NonEmptyString = string & INonEmptyStringTag;

// tslint:disable-next-line:no-any
export function isNonEmptyString(s: any): s is NonEmptyString {
  return(typeof s === "string" && s.length > 0);
}

export function toNonEmptyString(s: string): Option<NonEmptyString> {
  return isNonEmptyString(s) ? some(s) : none;
}
