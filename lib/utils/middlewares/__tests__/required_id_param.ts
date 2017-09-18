// tslint:disable:no-any

import { RequiredIdParamMiddleware } from "../required_id_param";

describe("RequiredIdParamMiddleware", () => {
  it("should extract the required parameter from the request", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {
        id: "hello"
      }
    } as any);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe("hello");
    }
  });

  it("should respond with a validation error if the required parameter is missing", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {}
    } as any);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toBe("IResponseErrorValidation");
    }
  });

  it("should respond with a validation error if the required parameter is empty", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {
        id: ""
      }
    } as any);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toBe("IResponseErrorValidation");
    }
  });
});
