
interface ILeft<L>  {
  readonly isLeft: true;
  readonly isRight: false;
  readonly left: L;
}

interface IRight<R> {
  readonly isLeft: false;
  readonly isRight: true;
  readonly right: R;
}

export function left<L>(v: L): ILeft<L> {
  return {
    isLeft: true,
    isRight: false,
    left: v,
  };
}

export function right<R>(v: R): IRight<R> {
  return {
    isLeft: false,
    isRight: true,
    right: v,
  };
}

export type Either<L, R> = ILeft<L> | IRight<R>;
