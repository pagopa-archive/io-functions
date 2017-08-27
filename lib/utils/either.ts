
interface ILeft<L>  {
  isLeft: true;
  isRight: false;
  left: L;
}

interface IRight<R> {
  isLeft: false;
  isRight: true;
  right: R;
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
