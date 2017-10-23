import { isProblemJson, ProblemJson, toProblemJson } from "../ProblemJson";

import { HttpStatusCode, toHttpStatusCode } from "../HttpStatusCode";

describe("ProblemJson#toProblemJson", () => {
  it("should returns a defined option for valid problem json", () => {
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
  it("should returns an empty option for invalid problem json", () => {
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
  it("should returns true if ProblemJson is well formed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {},
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: undefined,
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: null,
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: undefined,
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: null,
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: undefined,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: null,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: undefined,
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: null,
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: undefined
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: null
      }
    ];
    fixtures.forEach(f => expect(isProblemJson(f)).toBe(true));
  });

  it("should returns false if ProblemJson is malformed", () => {
    const httpStatusCode: HttpStatusCode = toHttpStatusCode(200).get;

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {
        detail: 1,
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: 2,
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: 99,
        title: "Lorem ipsum dolor sit amet",
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: 3,
        type: "type"
      },
      {
        detail: "detail",
        instance: "instance",
        status: httpStatusCode,
        title: "Lorem ipsum dolor sit amet",
        type: 4
      }
    ];
    fixtures.forEach(f => expect(isProblemJson(f)).toBeFalsy());
  });
});
