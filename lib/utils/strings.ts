import is from "ts-is";
import * as validator from "validator";

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

interface IEmailStringTag {
  readonly kind: "INonEmptyStringTag";
}

/**
 * A string guaranteed to have a length within the range [L,H)
 */
export type WithinRangeString<L extends number, H extends number> = string &
  IWithinRangeStringTag<L, H>;

export function isWithinRangeString<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any,
  l: L,
  h: H
): arg is WithinRangeString<L, H> {
  return typeof arg === "string" && arg.length >= l && arg.length < h;
}

export function toWithinRangeString<L extends number, H extends number>(
  // tslint:disable-next-line:no-any
  arg: any,
  l: L,
  h: H
): Option<WithinRangeString<L, H>> {
  return option(arg).filter(_ => isWithinRangeString(_, l, h));
}

/**
 * A non-empty string
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
 * A string that matches a pattern.
 */
export type PatternString<P extends string> = string & IPatternStringTag<P>;

export function isPatternString<P extends string>(
  // tslint:disable-next-line:no-any
  arg: any,
  p: P
): arg is PatternString<P> {
  return typeof arg === "string" && arg.match(p) !== null;
}

export function toPatternString<P extends string>(
  // tslint:disable-next-line:no-any
  arg: any,
  p: P
): Option<PatternString<P>> {
  return option(arg).filter(_ => isPatternString(_, p));
}

/**
 * A string that represents a valid email address.
 */
export type EmailString = string & IEmailStringTag;

export const isEmailString = is<EmailString>(arg => {
  return (
    typeof arg === "string" &&
    validator.isEmail(arg, {
      allow_display_name: false,
      allow_utf8_local_part: false,
      require_tld: true
    })
  );
});

export function toEmailString(
  // tslint:disable-next-line:no-any
  arg: any
): Option<EmailString> {
  return option(arg).filter(isEmailString);
}
