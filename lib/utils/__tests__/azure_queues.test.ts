/* tslint:disable:no-any */

jest.mock("winston");

import { left, right } from "fp-ts/lib/Either";
import {
  PermanentError,
  TransientError
} from "io-functions-commons/dist/src/utils/errors";
import * as config from "../../../host.json";
import {
  handleQueueProcessingFailure,
  MAX_RETRIES,
  updateMessageVisibilityTimeout
} from "../azure_queues";

const aQueueName = "aQueueName";

const aQueueService = {
  updateMessage: jest.fn((_, __, ___, ____, cb) => {
    cb(new Error("anError"));
  })
};

const aMessage = {
  dequeueCount: 1,
  id: "1",
  popReceipt: "receipt"
};

const aMessageWithManyRetries = {
  dequeueCount: 100000,
  id: "1",
  popReceipt: "receipt"
};

afterEach(() => {
  jest.clearAllMocks();
  // do not restore aQueueService mock !
});

describe("azureQueues", () => {
  it("should have MAX_RETRIES = maxDequeueCount - 1", async () => {
    expect(MAX_RETRIES).toEqual((config as any).queues.maxDequeueCount - 1);
  });
});

describe("updateMessageVisibilityTimeout", () => {
  it("should update the message timeout", async () => {
    const result = await updateMessageVisibilityTimeout(
      aQueueService as any,
      aQueueName,
      aMessage as any
    );
    expect(aQueueService.updateMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual(true);
  });

  it("should fail in case dequeue count is undefined", async () => {
    expect.assertions(2);
    try {
      await updateMessageVisibilityTimeout(aQueueService as any, aQueueName, {
        ...aMessage,
        dequeueCount: undefined
      } as any);
    } catch (e) {
      expect(aQueueService.updateMessage).not.toHaveBeenCalled();
      expect(e).toBeDefined();
    }
  });

  it("should not update the message timeout in case the maximum number of retries is reached", async () => {
    const result = await updateMessageVisibilityTimeout(
      aQueueService as any,
      "queueName",
      aMessageWithManyRetries as any
    );
    expect(aQueueService.updateMessage).not.toHaveBeenCalled();
    expect(result).toEqual(false);
  });
});

describe("handleQueueProcessingFailure", () => {
  it("should throw on transient error", async () => {
    const transientErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    const permanentErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    expect.assertions(3);
    try {
      await handleQueueProcessingFailure(
        aQueueService as any,
        aMessage as any,
        aQueueName,
        transientErrorSpy,
        permanentErrorSpy,
        TransientError("transient")
      );
    } catch (e) {
      expect(transientErrorSpy).toHaveBeenCalledTimes(1);
      expect(permanentErrorSpy).not.toHaveBeenCalled();
      expect(e).toBeDefined();
    }
  });

  it("should not throw on transient error and max retries reached", async () => {
    const transientErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    const permanentErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    await handleQueueProcessingFailure(
      aQueueService as any,
      aMessageWithManyRetries as any,
      aQueueName,
      transientErrorSpy,
      permanentErrorSpy,
      TransientError("transient")
    );
    expect(transientErrorSpy).toHaveBeenCalledTimes(1);
    expect(permanentErrorSpy).not.toHaveBeenCalled();
  });

  it("should throw on nested transient error", async () => {
    const transientErrorSpy = jest.fn(() =>
      Promise.resolve(left(TransientError("err")))
    );
    const permanentErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    expect.assertions(3);
    try {
      await handleQueueProcessingFailure(
        aQueueService as any,
        aMessage as any,
        aQueueName,
        transientErrorSpy,
        permanentErrorSpy,
        TransientError("transient")
      );
    } catch (e) {
      expect(transientErrorSpy).toHaveBeenCalledTimes(1);
      expect(permanentErrorSpy).not.toHaveBeenCalled();
      expect(e).toBeDefined();
    }
  });

  it("should recurse and throw on nested permanent error", async () => {
    const permanentErrorSpy = jest.fn(() =>
      Promise.resolve(left(TransientError("err")))
    );
    const transientErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    expect.assertions(3);
    try {
      await handleQueueProcessingFailure(
        aQueueService as any,
        aMessage as any,
        aQueueName,
        transientErrorSpy,
        permanentErrorSpy,
        PermanentError("transient")
      );
    } catch (e) {
      expect(transientErrorSpy).toHaveBeenCalledTimes(1);
      expect(permanentErrorSpy).toHaveBeenCalledTimes(1);
      expect(e).toBeDefined();
    }
  });

  it("should return on permanent error", async () => {
    const transientErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    const permanentErrorSpy = jest.fn(() => Promise.resolve(right(undefined)));
    const ret = await handleQueueProcessingFailure(
      aQueueService as any,
      aMessage as any,
      aQueueName,
      transientErrorSpy,
      permanentErrorSpy,
      PermanentError("permanent")
    );
    expect(permanentErrorSpy).toHaveBeenCalledTimes(1);
    expect(transientErrorSpy).not.toHaveBeenCalled();
    expect(ret).toBeUndefined();
  });
});
