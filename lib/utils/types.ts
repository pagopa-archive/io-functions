// tslint:disable:no-any
import * as t from "io-ts";

import { Set as SerializableSet } from "json-set-map";

/**
 * An io-ts Type tagged with T
 */
export type Tagged<T, S, A> = t.Type<S, A & T>;

/**
 * Tags an io-ts type with an interface T
 */
export const tag = <T>() => <S, A>(type: t.Type<S, A>): Tagged<T, S, A> =>
  type as any;

const getObjectValues = <T extends object>(obj: T): ReadonlyArray<string> =>
  Object.keys(obj).reduce<ReadonlyArray<string>>(
    (acc, key) => [...acc, (obj as any)[key]],
    []
  );

/**
 * Creates an io-ts Type from an enum
 */
export const enumType = <E>(e: {}, name: string): t.Type<any, E> => {
  const values = getObjectValues(e);

  return new t.Type<any, E>(
    name,
    (v): v is E => typeof v === "string" && values.indexOf(v) >= 0,
    (s, c) => (this.is(s) ? t.success(s) : t.failure(s, c)),
    t.identity
  );
};

/**
 * Creates an io-ts Type from a ReadonlySet
 */
export const readonlySetType = <S, E>(
  o: t.Type<S, E>,
  name: string
): t.Type<any, ReadonlySet<E>> => {
  const arrayType = t.readonlyArray(o, name);
  return new t.Type<any, ReadonlySet<E>>(
    name,
    (s): s is ReadonlySet<E> => s instanceof Set && arrayType.is(Array.from(s)),
    (s, c) => {
      if (s instanceof Set && arrayType.is(Array.from(s))) {
        return t.success(s);
      }
      if (arrayType.is(s)) {
        return t.success(new SerializableSet(Array.from(s)));
      }
      return t.failure(s, c);
    },
    t.identity
  );
};

/**
 * Returns a new type that has only the F fields of type T.
 */
export type LimitedFields<T, F extends keyof T> = { [P in F]: T[P] };
