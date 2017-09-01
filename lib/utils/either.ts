/*
 * A simple Either type
 */

interface IEitherAttributes  {
  readonly isLeft: boolean;
  readonly isRight: boolean;
}

interface IEitherMethods<L, R> {
  readonly mapLeft: <V>(f: (r: L) => V) => Either<V, R>;
  readonly mapRight: <V>(f: (r: R) => V) => Either<L, V>;
}

interface ILeftAttributes<L> extends IEitherAttributes {
  readonly isLeft: true;
  readonly isRight: false;
  readonly left: L;
}

interface IRightAttributes<R> extends IEitherAttributes {
  readonly isLeft: false;
  readonly isRight: true;
  readonly right: R;
}

interface ILeft<L, R> extends ILeftAttributes<L>, IEitherMethods<L, R> {}

interface IRight<L, R> extends IRightAttributes<R>, IEitherMethods<L, R> {}

/**
 * Constructs a Left value
 */
export function left<L, R>(v: L): ILeft<L, R> {
  return {
    isLeft: true,
    isRight: false,
    left: v,
    mapLeft: <V>(f: (l: L) => V): ILeft<V, R> => left(f(v)),
    mapRight: <V>(_: (r: R) => V): ILeft<L, V> => left(v),
  };
}

/**
 * Constructs a Right value
 */
export function right<L, R>(v: R): IRight<L, R> {
  return {
    isLeft: false,
    isRight: true,
    mapLeft: <V>(_: (l: L) => V): IRight<V, R> => right(v),
    mapRight: <V>(f: (r: R) => V): IRight<L, V> => right(f(v)),
    right: v,
  };
}

export type Either<L, R> = ILeft<L, R> | IRight<L, R>;
