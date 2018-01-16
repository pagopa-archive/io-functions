import * as config from "../../../host.json";
import { MAX_RETRIES, retryMessageEnqueue } from "../azure_queues";

const aQueueService = {
  updateMessage: jest.fn((_, __, ___, ____, cb) => {
    cb({});
  })
};

const aContext = {
  bindingData: {
    dequeueCount: 1,
    id: "1",
    popReceipt: "receipt"
  },
  bindings: {},
  done: jest.fn(),
  invocationId: "1",
  log: jest.fn(),
  warn: jest.fn()
};

const aContextWithManyRetries = {
  bindingData: {
    dequeueCount: 100000,
    id: "1",
    popReceipt: "receipt"
  },
  bindings: {},
  done: jest.fn(),
  invocationId: "1",
  log: jest.fn(),
  warn: jest.fn()
};

describe("azureQueues", () => {
  it("should have MAX_RETRIES = maxDequeueCount - 1", async () => {
    // tslint:disable-next-line:no-any
    expect(MAX_RETRIES).toEqual((config as any).queues.maxDequeueCount - 1);
  });
});

describe("retry", () => {
  afterEach(() => jest.clearAllMocks());

  it("should call context.done() with an argument", async () => {
    // tslint:disable-next-line:no-any
    retryMessageEnqueue(aQueueService as any, "queueName", aContext as any);
    expect(aQueueService.updateMessage).toHaveBeenCalledTimes(1);
    expect(aContext.done).toHaveBeenCalledTimes(1);
    expect(aContext.done).toHaveBeenCalledWith(expect.anything());
  });

  it("should not update the message timeout in case the maximum number of retries is reached", async () => {
    retryMessageEnqueue(
      // tslint:disable-next-line:no-any
      aQueueService as any,
      "queueName",
      // tslint:disable-next-line:no-any
      aContextWithManyRetries as any
    );
    expect(aQueueService.updateMessage).not.toHaveBeenCalled();
    expect(aContextWithManyRetries.done).toHaveBeenCalledTimes(1);
    expect(aContextWithManyRetries.done).toHaveBeenCalledWith(
      expect.anything()
    );
  });
});
