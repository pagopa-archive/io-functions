import { isProblemJson, ProblemJson, toProblemJson } from "../ProblemJson";

import { HttpStatusCode, toHttpStatusCode } from "../HttpStatusCode";

describe("Check ProblemJson methods", () => {
  test("toProblemJson", () => {
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

  test("isProblemJson", () => {
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

  test("isProblemJson, check detail property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: 1,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    const problemJsonTwo: ProblemJson = {
      detail: undefined,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:disable */
    const problemJsonThree: ProblemJson = {
      detail: null,
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonOne)).toBe(false);
    expect(isProblemJson(problemJsonTwo)).toBe(true);
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });

  test("isProblemJson, check instance property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: 2,
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    const problemJsonTwo: ProblemJson = {
      detail: "detail",
      instance: undefined,
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:disable */
    const problemJsonThree: ProblemJson = {
      detail: "detail",
      instance: null,
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonOne)).toBe(false);
    expect(isProblemJson(problemJsonTwo)).toBe(true);
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });

  test("isProblemJson, check status property", () => {
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: 99,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    const problemJsonTwo: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: undefined,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:disable */
    const problemJsonThree: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: null,
      title: "Lorem ipsum dolor sit amet",
      type: "type"
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonOne)).toBe(false);
    expect(isProblemJson(problemJsonTwo)).toBe(true);
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });

  test("isProblemJson, check title property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: 3,
      type: "type"
    };
    const problemJsonTwo: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: undefined,
      type: "type"
    };
    /* tslint:disable */
    const problemJsonThree: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: null,
      type: "type"
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonOne)).toBe(false);
    expect(isProblemJson(problemJsonTwo)).toBe(true);
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });

  test("isProblemJson, check type property", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;
    const problemJsonOne = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: 4
    };
    const problemJsonTwo: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: undefined
    };
    /* tslint:disable */
    const problemJsonThree: ProblemJson = {
      detail: "detail",
      instance: "instance",
      status: httpStatusCode,
      title: "Lorem ipsum dolor sit amet",
      type: null
    };
    /* tslint:enable */

    expect(isProblemJson(problemJsonOne)).toBe(false);
    expect(isProblemJson(problemJsonTwo)).toBe(true);
    expect(isProblemJson(problemJsonThree)).toBe(true);
  });
});
