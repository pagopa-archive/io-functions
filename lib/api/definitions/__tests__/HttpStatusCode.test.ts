import {
  HttpStatusCode,
  isHttpStatusCode,
  toHttpStatusCode
} from "../HttpStatusCode";

describe("Check HttpStatusCode methods", () => {
  test("toHttpStatusCode", () => {
    const httpStatusCodeOne: HttpStatusCode = 100;
    const httpStatusCodeTwo: HttpStatusCode = 99;

    expect(toHttpStatusCode(httpStatusCodeOne).get).toEqual(httpStatusCodeOne);
    expect(toHttpStatusCode(httpStatusCodeTwo)).toEqual({});
  });

  test("isHttpStatusCode", () => {
    const httpStatusCodeOne: HttpStatusCode = 100;
    const httpStatusCodeTwo: HttpStatusCode = 99;
    const httpStatusCodeThree: HttpStatusCode = "200";

    expect(isHttpStatusCode(httpStatusCodeOne)).toBe(true);
    expect(isHttpStatusCode(httpStatusCodeTwo)).toBe(false);
    expect(isHttpStatusCode(httpStatusCodeThree)).toBe(false);
  });
});
