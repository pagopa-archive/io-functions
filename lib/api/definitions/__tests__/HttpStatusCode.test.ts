import {
  HttpStatusCode,
  isHttpStatusCode,
  toHttpStatusCode
} from "../HttpStatusCode";

import { toWithinRangeNumber } from "../../../utils/numbers";

describe("Check HttpStatusCode methods", () => {
  test("toHttpStatusCode", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(toHttpStatusCode(httpStatusCodeOne).get).toEqual(httpStatusCodeOne);
    expect(toHttpStatusCode(99)).toEqual({});
  });

  test("isHttpStatusCode", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(isHttpStatusCode(httpStatusCodeOne)).toBe(true);
    expect(isHttpStatusCode(99)).toBe(false);
    expect(isHttpStatusCode("200")).toBe(false);
  });
});
