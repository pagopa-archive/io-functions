/*
 * Useful tagged types for numbers
 */

import { none, Option, some } from "ts-option";

declare class NonNegativeNumberTag {
  private dummy: boolean;
}

export type NonNegativeNumber = number & NonNegativeNumberTag;

/**
 * Type guard for numbers that are non-negative.
 */
export function isNonNegativeNumber(n: number): n is NonNegativeNumber {
  return n >= 0;
}

/**
 * Returns a defined option if the provided number is non-negative.
 */
export function toNonNegativeNumber(n: number): Option<NonNegativeNumber> {
  if (isNonNegativeNumber(n)) {
    return some(n);
  } else {
    return none;
  }
}
