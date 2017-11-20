// tslint:disable:no-any

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";

import { RequiredParamMiddleware } from "../required_param";

describe("RequiredParamMiddleware", () => {
  it("should extract the required parameter from the request", async () => {
    const middleware = RequiredParamMiddleware(params => right(params.param));

    const result = await middleware({
      params: {
        param: "hello"
      }
    } as any);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toBe("hello");
    }
  });

  it("should respond with a validation error if the required parameter is missing", async () => {
    const middleware = RequiredParamMiddleware(_ => left("param not found"));

    const result = await middleware({
      params: {}
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
