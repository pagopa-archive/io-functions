// tslint:disable:no-any

import { left, right } from "../../either";

import { RequiredParamMiddleware } from "../required_param";

describe("RequiredParamMiddleware", () => {

  it("should extract the required parameter from the request", async () => {
    const middleware = RequiredParamMiddleware((params) => right(params.param));

    const result = await middleware({
      params: {
        param: "hello",
      },
    } as any);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe("hello");
    }
  });

  it("should respond with a validation error if the required parameter is missing", async () => {
    const middleware = RequiredParamMiddleware((params) => left("param not found"));

    const result = await middleware({
      params: { },
    } as any);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toBe("IResponseErrorValidation");
    }
  });

});
