// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { IRequestMiddleware, withRequestMiddlewares } from "../request_middleware";

const ResolvingMiddleware: IRequestMiddleware<string> = (req, _) => {
  return Promise.resolve(req.params.dummy);
};

const RejectingMiddleware: IRequestMiddleware<string> = (req, res) => {
  res.send(req.params.dummy);
  return Promise.reject(null);
};

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

const request = {
  params: {
    dummy: "dummy",
  },
};

describe("withRequestMiddlewares", () => {

  it("should process a request with a resolving middleware (1)", () => {
    const mockHandler = jest.fn();

    const response = MockResponse();

    withRequestMiddlewares(ResolvingMiddleware)
      (mockHandler)
      (request as any, response, null as any);

    return flushPromises().then(() => {
      expect(mockHandler).toHaveBeenCalledWith(response, "dummy");
    });

  });

  it("should process a request with a resolving middleware (2)", () => {
    const mockHandler = jest.fn();

    const response = MockResponse();

    withRequestMiddlewares(ResolvingMiddleware, ResolvingMiddleware)
      (mockHandler)
      (request as any, response, null as any);

    return flushPromises().then(() => {
      expect(mockHandler).toHaveBeenCalledWith(response, "dummy", "dummy");
    });

  });

  it("should process a request with a resolving middleware (3)", () => {
    const mockHandler = jest.fn();

    const response = MockResponse();

    withRequestMiddlewares(ResolvingMiddleware, ResolvingMiddleware, ResolvingMiddleware)
      (mockHandler)
      (request as any, response, null as any);

    return flushPromises().then(() => {
      expect(mockHandler).toHaveBeenCalledWith(response, "dummy", "dummy", "dummy");
    });

  });

  it("should process a request with a rejecting middleware", () => {
    const mockHandler = jest.fn();

    const response = MockResponse();

    withRequestMiddlewares(RejectingMiddleware)
      (mockHandler)
      (request as any, response, null as any);

    return flushPromises().then(() => {
      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.send).toHaveBeenCalledWith("dummy");
    });

  });

  it("should stop processing middlewares after a rejecting middleware", () => {
    const mockHandler = jest.fn();

    const response = MockResponse();

    withRequestMiddlewares(RejectingMiddleware, ResolvingMiddleware)
      (mockHandler)
      (request as any, response, null as any);

    return flushPromises().then(() => {
      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.send).toHaveBeenCalledWith("dummy");
    });

  });

});
