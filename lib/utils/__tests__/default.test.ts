import { isRight } from "fp-ts/lib/Either";
import * as t from "io-ts";

import { withDefault } from "../default";

const defaultString = withDefault(t.string, "DEFAULT");

const defaultObject = t.partial({
  k: defaultString
});

describe("withDefault (single value)", () => {
  it("should evaluate to the valid value", () => {
    const r = defaultString.decode("hello");
    expect(isRight(r));
    expect(r.value).toEqual("hello");
  });

  it("should evaluate to the default value", () => {
    const r = defaultString.decode(undefined);
    expect(isRight(r));
    expect(r.value).toEqual("DEFAULT");
  });

  it("should evaluate to the default value", () => {
    // tslint:disable-next-line:no-null-keyword
    const r = defaultString.decode(null);
    expect(isRight(r));
    expect(r.value).toEqual("DEFAULT");
  });
});

describe("withDefault (composed partial)", () => {
  it("should evaluate to the valid value", () => {
    const r = defaultObject.decode({ k: "hello" });
    expect(isRight(r));
    expect(r.value).toEqual({ k: "hello" });
  });

  it("should evaluate to the default value", () => {
    const r = defaultObject.decode({});
    expect(isRight(r));
    expect(r.value).toEqual({ k: "DEFAULT" });
  });

  it("should evaluate to the default value", () => {
    // tslint:disable-next-line:no-null-keyword
    const r = defaultObject.decode({ k: undefined });
    expect(isRight(r));
    expect(r.value).toEqual({ k: "DEFAULT" });
  });
});
