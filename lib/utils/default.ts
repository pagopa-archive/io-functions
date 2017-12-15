// tslint:disable:no-any
import * as t from "io-ts";

export function withDefault<T extends t.Any>(
  type: T,
  defaultValue: t.TypeOf<T>
): t.Type<any, t.TypeOf<T>> {
  return new t.Type(
    type.name,
    (v: any): v is T => type.is(v),
    (v: any, c: any) => type.validate(v !== undefined ? v : defaultValue, c),
    (v: any) => type.serialize(v)
  );
}
