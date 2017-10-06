import {
  HttpStatusCode,
  isHttpStatusCode,
  toHttpStatusCode
} from "../HttpStatusCode";

import { toWithinRangeNumber } from "../../../utils/numbers";

describe("HttpStatusCode#toHttpStatusCode", () => {
  test("should returns a defined option for valid http status code", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(toHttpStatusCode(httpStatusCodeOne).get).toEqual(httpStatusCodeOne);
  });
  test("should returns a empty option for malformed http status code", () => {
    expect(toHttpStatusCode("200")).toEqual({});
  });
  test("should returns a empty option for a invalid http status code", () => {
    expect(toHttpStatusCode(99)).toEqual({});
  });
});

describe("HttpStatusCode#isHttpStatusCode", () => {
  test("should returns true if http status code is well formed", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(isHttpStatusCode(httpStatusCodeOne)).toBe(true);
  });
  test("should returns false if http status code is malformed", () => {
    expect(isHttpStatusCode("200")).toBe(false);
  });
  test("should returns false if http status code is invalid", () => {
    expect(isHttpStatusCode(99)).toBe(false);
  });
});
