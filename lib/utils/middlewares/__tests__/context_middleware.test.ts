// tslint:disable:no-any

import { ContextMiddleware } from "../context_middleware";

interface ITestBindings {
  readonly test: string;
}

describe("ContextMiddleware", () => {

  it("should extract the context from the request", async () => {
    const middleware = ContextMiddleware<ITestBindings>();
    const response = await middleware({
      context: {
        bindings: {
          test: "test",
        },
      },
    } as any);

    expect(response.isRight).toBeTruthy();
    if (response.isRight) {
      expect(response.right).toEqual({
        bindings: {
          test: "test",
        },
      });
    }
  });

});
