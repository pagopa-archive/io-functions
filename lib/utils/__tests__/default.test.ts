import { isRight } from "fp-ts/lib/Either";
import * as t from "io-ts";

import { withDefault } from "../default";

const defaultString = withDefault(t.string, "DEFAULT");

const defaultObject = t.partial({
  k: defaultString
});

describe("withDefault (single value)", () => {
  it("should evaluate to the valid value", () => {
    const r = t.validate("hello", defaultString);
    expect(isRight(r));
    expect(r.value).toEqual("hello");
  });

  it("should evaluate to the default value", () => {
    const r = t.validate(undefined, defaultString);
    expect(isRight(r));
    expect(r.value).toEqual("DEFAULT");
  });

  it("should evaluate to the default value", () => {
    // tslint:disable-next-line:no-null-keyword
    const r = t.validate(null, defaultString);
    expect(isRight(r));
    expect(r.value).toEqual("DEFAULT");
  });
});

describe("withDefault (composed partial)", () => {
  it("should evaluate to the valid value", () => {
    const r = t.validate({ k: "hello" }, defaultObject);
    expect(isRight(r));
    expect(r.value).toEqual({ k: "hello" });
  });

  it("should evaluate to the default value", () => {
    const r = t.validate({}, defaultObject);
    expect(isRight(r));
    expect(r.value).toEqual({ k: "DEFAULT" });
  });

  it("should evaluate to the default value", () => {
    // tslint:disable-next-line:no-null-keyword
    const r = t.validate({ k: undefined }, defaultObject);
    expect(isRight(r));
    expect(r.value).toEqual({ k: "DEFAULT" });
  });
});
