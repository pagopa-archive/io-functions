// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys
import * as t from "io-ts";

import { NonEmptyString } from "../strings";

import { NonNegativeNumber } from "../numbers";

import { strictInterfaceWithOptionals } from "../types";

import { ReadableReporter } from "../validation_reporters";

const TestType = t.interface(
  {
    a: t.number,
    b: t.string,
    c: t.interface(
      {
        a: t.number,
        b: NonEmptyString
      },
      "SubTestType"
    )
  },
  "TestType"
);

describe("ReadableReporter", () => {
  it("should report validation errors", () => {
    const fixtures: ReadonlyArray<any> = [
      {
        o: "",
        vt: NonEmptyString,
        e: ["value is not a non empty string"]
      },
      {
        o: -1,
        vt: NonNegativeNumber,
        e: ["value is not a number >= 0"]
      },
      {
        o: {
          a: "a",
          b: 1,
          c: {
            a: "b"
          }
        },
        vt: TestType,
        e: [
          "value.a is not a number",
          "value.b is not a string",
          "value.c.a is not a number",
          "value.c.b is not a non empty string"
        ]
      }
    ];

    fixtures.forEach(({ o, vt, e }) => {
      const validation = t.validate(o, vt);

      const res = ReadableReporter.report(validation);

      expect(res).toEqual(e);
    });
  });

  it("should report validation errors on unknow properties", () => {
    const aType = strictInterfaceWithOptionals(
      {
        foo: t.boolean
      },
      {},
      "aType"
    );
    const validation = t.validate({ foo: true, x: true }, aType);
    const res = ReadableReporter.report(validation);
    expect(res).toEqual(["value.x: unknow property"]);
  });
});
