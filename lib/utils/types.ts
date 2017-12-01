import * as t from "io-ts";

export type Tagged<T, S, A> = t.Type<S, A & T>;

export const tag = <T>() => <S, A>(type: t.Type<S, A>): Tagged<T, S, A> =>
  // tslint:disable-next-line:no-any
  type as any;

const getObjectValues = (obj: {}): ReadonlyArray<string> =>
  Object.keys(obj).reduce<ReadonlyArray<string>>(
    // tslint:disable-next-line:no-any
    (acc, key) => [...acc, (obj as any)[key]],
    []
  );

// tslint:disable-next-line:no-any
export const createEnumType = <E>(e: {}, name: string): t.Type<any, E> => {
  const values = getObjectValues(e);

  // tslint:disable-next-line:no-any
  return new t.Type<any, E>(
    name,
    (v): v is E => typeof v === "string" && values.indexOf(v) >= 0,
    (s, c) => (this.is(s) ? t.success(s) : t.failure(s, c)),
    t.identity
  );
};

/**
 * Returns a new type that has only the F fields of type T.
 */
export type LimitedFields<T, F extends keyof T> = { [P in F]: T[P] };
