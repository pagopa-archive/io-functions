// tslint:disable:no-any

import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";

import { RequiredParamMiddleware } from "../required_param";

describe("RequiredParamMiddleware", () => {
  const middleware = RequiredParamMiddleware("param", t.string);

  it("should extract the required parameter from the request", async () => {
    const result = await middleware({
      params: {
        param: "hello"
      }
    } as any);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect<any>(result.value).toBe("hello");
    }
  });

  it("should respond with a validation error if the required parameter is missing", async () => {
    const result = await middleware({
      params: {}
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
