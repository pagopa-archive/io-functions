// tslint:disable:no-any

import * as Express from "express";

import { response as MockResponse } from "jest-mock-express";

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { ResponseJsonIterator } from "../response";

describe("ResponseSuccessJsonIterator", () => {
  it("should stream an empty iterator as json", async () => {
    const mockIteratorResult = {
      items: [],
      page_size: 0
    };
    const mockIterator = {
      executeNext: jest
        .fn()
        .mockReturnValueOnce(Promise.resolve(right(some([]))))
        .mockReturnValue(Promise.resolve(right(none)))
    };

    const streamingResponse = ResponseJsonIterator(mockIterator);

    const mockResponse = MockResponse() as Express.Response;

    await streamingResponse.apply(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockIteratorResult);
  });

  it("should stream an iterator with a single page as json", async () => {
    const mockIteratorResult = {
      items: [{ data: "a" }],
      page_size: 1
    };
    const mockIterator = {
      executeNext: jest.fn()
    };

    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([{ data: "a" }])))
    );
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const streamingResponse = ResponseJsonIterator(mockIterator);

    const mockResponse = MockResponse() as Express.Response;

    await streamingResponse.apply(mockResponse);

    expect(mockIterator.executeNext).toHaveBeenCalledTimes(2);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockIteratorResult);
  });

  it("should remove the kind attribute", async () => {
    const mockIteratorkindlessResult = {
      items: [{ data: "a" }],
      page_size: 1
    };
    const mockIterator = {
      executeNext: jest.fn()
    };

    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([{ data: "a", kind: "IResponse" }])))
    );
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const streamingResponse = ResponseJsonIterator(mockIterator);

    const mockResponse = MockResponse() as Express.Response;

    await streamingResponse.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith(mockIteratorkindlessResult);
  });

  it("should return error on failures during query", async () => {
    const queryError = {
      body: "too many requests",
      code: 429
    };
    const mockIterator = {
      executeNext: jest.fn(() => Promise.resolve(left(queryError)))
    };

    const streamingResponse = ResponseJsonIterator(mockIterator);

    const mockResponse = MockResponse() as Express.Response;

    await streamingResponse.apply(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: "too many requests",
        status: 500,
        title: "Query error (429)"
      })
    );
  });
});
