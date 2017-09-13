/*
 * Useful tagged types for numbers
 */

import is from "ts-is";
import { Option, option } from "ts-option";

interface IWithinRangeNumberTag<L extends number, H extends number> {
  readonly lower: L;
  readonly higher: H;
  readonly kind: "IWithinRangeNumberTag";
}

interface INonNegativeNumberTag {
  readonly kind: "INonNegativeNumberTag";
}

/**
 * A number guaranteed to be within the range [L,H)
 */
export type WithinRangeNumber<L extends number, H extends number> = number & IWithinRangeNumberTag<L, H>;

/**
 * Type guard for numbers that are within a range.
 */
export function isWithinRangeNumber<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any, l: L, h: H,
): arg is WithinRangeNumber<L, H> {
  return typeof arg === "number" && arg >= l && arg < h;
}

/**
 * Returns a defined option if the provided number is within the provided range.
 */
export function toWithinRangeNumber<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any, l: L, h: H,
): Option<WithinRangeNumber<L, H>> {
  return option(arg).filter((_) => isWithinRangeNumber(_, l, h));
}

/**
 * A non negative number
 */
export type NonNegativeNumber = number & INonNegativeNumberTag;

/**
 * Type guard for numbers that are non-negative.
 */
export const isNonNegativeNumber = is<NonNegativeNumber>((n) => typeof n === "number" && n >= 0);

/**
 * Returns a defined option if the provided number is non-negative.
 */
// tslint:disable-next-line:no-any
export function toNonNegativeNumber(arg: any): Option<NonNegativeNumber> {
  return option(arg).filter(isNonNegativeNumber);
}
