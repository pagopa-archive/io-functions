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

const isEnumKey = (v: any, e: {}): boolean =>
  typeof v === "string" && e.hasOwnProperty(v);

/**
 * Creates an io-ts Type from an enum
 */
export const enumType = <E>(e: {}, name: string): t.Type<any, E> => {
  return new t.Type<any, E>(
    name,
    (v): v is E => isEnumKey(v, e),
    (v, c) => (isEnumKey(v, e) ? t.success(v) : t.failure(v, c)),
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

/**
 *  True when the input is an object (and not array).
 */
export const isObject = (o: {}) =>
  o instanceof Object && o.constructor === Object;

/**
 * Return an object filtering out keys that point to undefined values.
 */
export function withoutUndefinedValues<T extends object>(obj: T): T {
  return Object.keys(obj).reduce(
    (acc, k) => {
      const value = obj[k as keyof T];
      return value !== undefined
        ? {
            // see https://github.com/Microsoft/TypeScript/pull/13288
            // tslint:disable-next-line:no-any
            ...(acc as any),
            [k]: isObject(value) ? withoutUndefinedValues(value) : value
          }
        : acc;
    },
    {} as T
  ) as T;
}

/**
 *  Return a new type that validates successfully only
 *  when the instance (object) contains no unknow properties.
 *
 *  @\required  required properties
 *  @optional   optional object properties
 */
export function strictInterfaceWithOptionals<
  R extends t.Props,
  O extends t.Props
>(
  required: R,
  optional: O,
  name: string
): t.Type<{}, t.InterfaceOf<R> & t.PartialOf<O>> {
  const loose = t.intersection([t.interface(required), t.partial(optional)]);
  const props = Object.assign({}, required, optional);
  return new t.Type(
    name,
    (v): v is t.InterfaceOf<R> & t.PartialOf<O> =>
      loose.is(v) &&
      Object.getOwnPropertyNames(v).every(k => props.hasOwnProperty(k)),
    (s, c) =>
      loose.validate(s, c).chain(o => {
        const errors: t.Errors = Object.getOwnPropertyNames(o)
          .map(
            key =>
              !props.hasOwnProperty(key)
                ? t.getValidationError(o[key], t.appendContext(c, key, t.never))
                : undefined
          )
          .filter((e): e is t.ValidationError => e !== undefined);
        return errors.length ? t.failures(errors) : t.success(o);
      }),
    loose.serialize
  );
}
