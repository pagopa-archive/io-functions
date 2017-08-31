// tslint:disable:no-any

import * as Express from "express";

import { response as MockResponse } from "jest-mock-express";

import { IResultIterator } from "../documentdb";

import {
  ResponseSuccessJsonIterator,
} from "../response";

function flushPromises<T>(): Promise<T> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("ResponseSuccessJsonIterator", () => {

  it("should stream an empty iterator as json", () => {
    const mockIterator = {
      executeNext: jest.fn(() => Promise.resolve([])),
    };

    const streamingResponse = ResponseSuccessJsonIterator(mockIterator);

    const mockResponse = (MockResponse() as any) as Express.Response;

    streamingResponse.apply(mockResponse);

    return flushPromises().then(() => {
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledTimes(2);
      expect((mockResponse.send as any).mock.calls).toEqual([
        ["["],
        ["{}]"],
      ]);
    });
  });

  it("should stream an iterator with a single page as json", () => {
    const mockIterator = {
      executeNext: jest.fn(),
    };

    mockIterator.executeNext.mockImplementationOnce(() => Promise.resolve([{data: "a"}]));
    mockIterator.executeNext.mockImplementationOnce(() => Promise.resolve(undefined));

    const streamingResponse = ResponseSuccessJsonIterator(mockIterator);

    const mockResponse = (MockResponse() as any) as Express.Response;

    streamingResponse.apply(mockResponse);

    return flushPromises().then(() => {
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledTimes(3);
      expect((mockResponse.send as any).mock.calls).toEqual([
        ["["],
        [`{"data":"a"},`],
        ["{}]"],
      ]);
    });
  });

});
