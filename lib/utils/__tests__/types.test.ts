import * as t from "io-ts";

import {
  strictInterfaceWithOptionals,
  withoutUndefinedValues
} from "./../types";

import { isLeft } from "fp-ts/lib/Either";
import { ReadableReporter } from "../validation_reporters";

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

describe("definedValues", () => {
  it("should filter out undefined properties recursively", async () => {
    const obj = {
      a: 1,
      b: undefined,
      c: {
        d: [1, 2],
        e: undefined
      }
    };

    const newObj = withoutUndefinedValues(obj);

    expect(Object.keys(newObj).length).toEqual(2);
    expect(Object.keys(newObj.c).length).toEqual(1);

    expect(newObj).toEqual({
      a: 1,
      c: {
        d: [1, 2]
      }
    });
  });
});

describe("strictInterfaceWithOptionals", () => {
  it("should reject unknow properties", async () => {
    const aType = strictInterfaceWithOptionals(
      {
        required: t.boolean
      },
      {
        optional: t.boolean
      },
      "aName"
    );
    const validation = t.validate({ required: true, x: true }, aType);
    const errors = ReadableReporter.report(validation).join(";");
    expect(isLeft(validation)).toBeTruthy();
    expect(errors).toEqual("value.x: unknow property");
  });
});
