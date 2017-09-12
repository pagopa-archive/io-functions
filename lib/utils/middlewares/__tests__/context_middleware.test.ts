// tslint:disable:no-any

import { ContextMiddleware } from "../context_middleware";

interface ITestBindings {
  readonly test: string;
}

describe("ContextMiddleware", () => {

  it("should extract the context from the request", async () => {
    const middleware = ContextMiddleware<ITestBindings>();
    const response = await middleware({
      app: {
        get: jest.fn(),
      },
    } as any);
    expect(response.isRight).toBeTruthy();
  });

});
