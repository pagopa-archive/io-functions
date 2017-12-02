import is from "ts-is";
import { ulid } from "ulid";
import * as validator from "validator";

import { fromNullable, Option } from "fp-ts/lib/Option";

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
  readonly kind: "IEmailStringTag";
}

interface IIPStringTag {
  readonly kind: "IIPStringTag";
}

// a generator of identifiers
export type ObjectIdGenerator = () => NonEmptyString;

export const ulidGenerator: ObjectIdGenerator = () => ulid() as NonEmptyString;

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
  return fromNullable(arg).filter(_ => isWithinRangeString(_, l, h));
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
  return fromNullable(s).filter(isNonEmptyString);
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
  return fromNullable(arg).filter(_ => isPatternString(_, p));
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
  return fromNullable(arg).filter(isEmailString);
}

/**
 * A string that represents an IP (v4 or v6).
 */
export type IPString = string & IIPStringTag;

export const isIPString = is<IPString>(arg => {
  return typeof arg === "string" && validator.isIP(arg);
});

export function toIPString(
  // tslint:disable-next-line:no-any
  arg: any
): Option<IPString> {
  return fromNullable(arg).filter(isIPString);
}
