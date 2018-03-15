import * as config from "../../../host.json";
import { MAX_RETRIES, updateMessageVisibilityTimeout } from "../azure_queues";

const aQueueService = {
  updateMessage: jest.fn((_, __, ___, ____, cb) => {
    cb({});
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

describe("azureQueues", () => {
  it("should have MAX_RETRIES = maxDequeueCount - 1", async () => {
    // tslint:disable-next-line:no-any
    expect(MAX_RETRIES).toEqual((config as any).queues.maxDequeueCount - 1);
  });
});

describe("retry", () => {
  afterEach(() => jest.clearAllMocks());

  it("should call context.done() with an argument", async () => {
    const result = await updateMessageVisibilityTimeout(
      // tslint:disable-next-line:no-any
      aQueueService as any,
      "queueName",
      // tslint:disable-next-line:no-any
      aMessage as any
    );
    expect(aQueueService.updateMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual(true);
  });

  it("should not update the message timeout in case the maximum number of retries is reached", async () => {
    const result = await updateMessageVisibilityTimeout(
      // tslint:disable-next-line:no-any
      aQueueService as any,
      "queueName",
      // tslint:disable-next-line:no-any
      aMessageWithManyRetries as any
    );
    expect(aQueueService.updateMessage).not.toHaveBeenCalled();
    expect(result).toEqual(false);
  });
});
