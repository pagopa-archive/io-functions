import is from "ts-is";

import { option, Option } from "ts-option";

interface IWithinRangeStringTag<L extends number, H extends number> {
  readonly lower: L;
  readonly higher: H;
  readonly kind: "IWithinRangeStringTag";
}

interface INonEmptyStringTag {
  readonly kind: "INonEmptyStringTag";
}

interface IPatternStringTag<P extends string> {
  readonly pattern: P;
  readonly kind: "IPatternStringTag";
}

/**
 * A number guaranteed to be within the range [L,H)
 */
export type WithinRangeString<L extends number, H extends number> = string &
  IWithinRangeStringTag<L, H>;

/**
 * Type guard for numbers that are within a range.
 */
export function isWithinRangeString<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any,
  l: L,
  h: H
): arg is WithinRangeString<L, H> {
  return typeof arg === "string" && arg.length >= l && arg.length < h;
}

/**
 * Returns a defined option if the provided number is within the provided range.
 */
export function toWithinRangeString<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any,
  l: L,
  h: H
): Option<WithinRangeString<L, H>> {
  return option(arg).filter(_ => isWithinRangeString(_, l, h));
}

/**
 * A tagged unboxed type that is a non-empty string
 */
export type NonEmptyString = string & INonEmptyStringTag;

export const isNonEmptyString = is<NonEmptyString>(
  s => typeof s === "string" && s.length > 0
);

// tslint:disable-next-line:no-any
export function toNonEmptyString(s: any): Option<NonEmptyString> {
  return option(s).filter(isNonEmptyString);
}

/**
 * A tagged unboxed type that is a string that matches a pattern.
 */
export type PatternString<P extends string> = string & IPatternStringTag<P>;

/**
 * Type guard for strings that match a pattern.
 */
export function isPatternString<P extends string>(
  // tslint:disable-next-line:no-any
  arg: any,
  p: P
): arg is PatternString<P> {
  return typeof arg === "string" && arg.match(p) !== null;
}

/**
 * Returns a defined option if the provided string that matches the pattern.
 */
export function toPatternString<P extends string>(
  // tslint:disable-next-line:no-any
  arg: any,
  p: P
): Option<PatternString<P>> {
  return option(arg).filter(_ => isPatternString(_, p));
}
