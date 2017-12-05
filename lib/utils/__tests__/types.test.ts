import * as t from "io-ts";

import { readonlySetType } from "../types";

describe("readonlySetType", () => {
  const aSetOfStrings = readonlySetType(t.string, "Set of strings");

  it("should validate", () => {
    // tslint:disable-next-line:no-any
    const fixtures: ReadonlyArray<any> = [[], ["a"], new Set("x")];

    fixtures.forEach(f => {
      const v = t.validate(f, aSetOfStrings);
      expect(v.isRight()).toBeTruthy();
    });
  });
});
