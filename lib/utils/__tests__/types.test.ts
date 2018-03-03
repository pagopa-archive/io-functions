import * as t from "io-ts";

import {
  DateFromString,
  strictInterfaceWithOptionals,
  withoutUndefinedValues
} from "./../types";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { readableReport } from "../validation_reporters";

import { enumType, readonlySetType } from "../types";

enum aValidEnum {
  "foo" = "fooValue",
  "bar" = "barValue"
}

describe("enumType", () => {
  it("should validate with valid enum values", () => {
    const aValidEnumType = enumType<aValidEnum>(aValidEnum, "aValidEnum");
    const validation = aValidEnumType.decode("fooValue");
    expect(isRight(validation)).toBeTruthy();
  });
  it("should not validate invalid enum values", () => {
    const aValidEnumType = enumType<aValidEnum>(aValidEnum, "aValidEnum");
    const validation = aValidEnumType.decode("booValue");
    expect(isRight(validation)).toBeFalsy();
  });
});

describe("readonlySetType", () => {
  const aSetOfStrings = readonlySetType(t.string, "Set of strings");

  it("should validate", () => {
    // tslint:disable-next-line:no-any
    const fixtures: ReadonlyArray<any> = [[], ["a"], new Set("x")];

    fixtures.forEach(f => {
      const v = aSetOfStrings.decode(f);
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
    const validation = aType.decode({ required: true, x: true });
    expect(isLeft(validation)).toBeTruthy();
    if (isLeft(validation)) {
      const errors = readableReport(validation.value);
      expect(errors).toEqual("value.x: unknow property");
    }
  });
});

describe("DateFromString", () => {
  it("should validate an ISO string", async () => {
    const isoDate = new Date().toISOString();
    const validation = DateFromString.decode(isoDate);
    expect(isRight(validation)).toBeTruthy();
    expect(DateFromString.is(new Date())).toBeTruthy();
  });
  it("should fail on invalid ISO string", async () => {
    const noDate = {};
    const validation = DateFromString.decode(noDate);
    expect(isLeft(validation)).toBeTruthy();
    expect(DateFromString.is(noDate)).toBeFalsy();
  });
});
