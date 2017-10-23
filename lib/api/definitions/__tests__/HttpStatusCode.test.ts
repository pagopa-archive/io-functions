import {
  HttpStatusCode,
  isHttpStatusCode,
  toHttpStatusCode
} from "../HttpStatusCode";

import { toWithinRangeNumber } from "../../../utils/numbers";

describe("HttpStatusCode#toHttpStatusCode", () => {
  it("should returns a defined option for valid http status code", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(toHttpStatusCode(httpStatusCodeOne).get).toEqual(httpStatusCodeOne);
  });
  it("should returns a empty option for malformed/invalid http status code", () => {
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = ["200", 99];
    fixtures.forEach(f => expect(toHttpStatusCode(f)).toEqual({}));
  });
});

describe("HttpStatusCode#isHttpStatusCode", () => {
  it("should returns true if http status code is well formed", () => {
    const httpStatusCodeOne: HttpStatusCode = toWithinRangeNumber(100, 100, 600)
      .get;

    expect(isHttpStatusCode(httpStatusCodeOne)).toBe(true);
  });
  it("should returns false if http status code is malformed/invalid", () => {
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = ["200", 99];
    fixtures.forEach(f => expect(isHttpStatusCode(f)).toBeFalsy());
  });
});
