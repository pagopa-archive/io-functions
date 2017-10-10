import { isProblemJson, ProblemJson, toProblemJson } from "../ProblemJson";

import { HttpStatusCode, toHttpStatusCode } from "../HttpStatusCode";

describe("ProblemJson#toProblemJson", () => {
  test("should returns a defined option for valid problem json", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJson: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };

    expect(toProblemJson(problemJson).get).toEqual(problemJson);
  });
  test("should returns an empty option for invalid problem json", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJson = {
      detail: 12345,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };

    expect(toProblemJson(problemJson)).toEqual({});
  });
});

describe("ProblemJson#isProblemJson", () => {
  test("should returns true if ProblemJson is well formed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJson: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };

    expect(isProblemJson(problemJson)).toBe(true);
  });

  test("should returns true if ProblemJson object does not have detail property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonTwo = {
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonTwo)).toBe(true);
  });
  test("should returns true if ProblemJson object does have detail property set to null", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    /* tslint:disable */
    const problemJsonThree = {
      detail: null,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
  test("should returns false if ProblemJson object does have detail property malformed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: 1,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonOne)).toBe(false);
  });

  test("should returns true if ProblemJson object does not have instance property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonTwo = {
      detail: "detail",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonTwo)).toBe(true);
  });
  test("should returns true if ProblemJson object does have instance property set to null", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    /* tslint:disable */
    const problemJsonThree = {
      detail: "detail",
      instance: null,
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
  test("should returns false if ProblemJson object does have instance property malformed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: 2,
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonOne)).toBe(false);
  });

  test("should returns true if ProblemJson object does not have status property", () => {
    const problemJsonTwo = {
      detail: "detail",
      instance: "instance",
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonTwo)).toBe(true);
  });
  test("should returns true if ProblemJson object does have status property set to null", () => {
    /* tslint:disable */
    const problemJsonThree = {
      detail: "detail",
      instance: "instance",
      status: null,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
  test("should returns false if ProblemJson object does have status property malformed", () => {
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: 99,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    expect(isProblemJson(problemJsonOne)).toBe(false);
  });

  test("should returns true if ProblemJson object does not have title property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonTwo = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      type: "type"
    };
    expect(isProblemJson(problemJsonTwo)).toBe(true);
  });
  test("should returns true if ProblemJson object does have title property set to null", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    /* tslint:disable */
    const problemJsonThree = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: null,
      type: "type"
    };
    /* tslint:enable */
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
  test("should returns false if ProblemJson object does have title property malformed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: 3,
      type: "type"
    };
    expect(isProblemJson(problemJsonOne)).toBe(false);
  });

  test("should returns true if ProblemJson object does not have type property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonTwo: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: undefined
    };
    expect(isProblemJson(problemJsonTwo)).toBe(true);
  });
  test("should returns true if ProblemJson object does have type property set to null", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    /* tslint:disable */
    const problemJsonThree = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: null
    };
    /* tslint:enable */
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
  test("should returns false if ProblemJson object does have type property malformed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: 4
    };
    expect(isProblemJson(problemJsonOne)).toBe(false);
  });
});
