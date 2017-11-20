// tslint:disable:no-any
import { isLeft, isRight } from "fp-ts/lib/Either";

import { RequiredIdParamMiddleware } from "../required_id_param";

describe("RequiredIdParamMiddleware", () => {
  it("should extract the required parameter from the request", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {
        id: "hello"
      }
    } as any);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toBe("hello");
    }
  });

  it("should respond with a validation error if the required parameter is missing", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {}
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("IResponseErrorValidation");
    }
  });

  it("should respond with a validation error if the required parameter is empty", async () => {
    const result = await RequiredIdParamMiddleware({
      params: {
        id: ""
      }
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
