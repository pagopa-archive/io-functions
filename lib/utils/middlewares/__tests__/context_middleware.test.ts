// tslint:disable:no-any

import { ContextMiddleware } from "../context_middleware";

interface ITestBindings {
  readonly test: string;
}

describe("ContextMiddleware", () => {
  it("should extract the context from the request", async () => {
    const middleware = ContextMiddleware<ITestBindings>();

    const context = {
      log: () => true
    };

    const request = {
      app: {
        get: s => context
      }
    };

    const response = await middleware(request as any);

    response.mapRight(c => expect(c).toEqual(context));
  });
});
