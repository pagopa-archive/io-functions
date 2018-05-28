/* tslint:disable:no-any */
/* tslint:disable:no-null-keyword */
/* tslint:disable:no-big-function */

// set a dummy value for the env vars needed by the handler
// tslint:disable-next-line:no-object-mutation
process.env = {
  ...process.env,
  COSMOSDB_NAME: "anyDbName",
  CUSTOMCONNSTR_COSMOSDB_KEY: "anyCosmosDbKey",
  CUSTOMCONNSTR_COSMOSDB_URI: "anyCosmosDbUri",
  QueueStorageConnection: "anyConnectionString",
  WEBHOOK_CHANNEL_URL: "https://example.com"
};

jest.mock("applicationinsights");
jest.mock("azure-storage");

import * as winston from "winston";

import { none, some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { FiscalCode } from "../api/definitions/FiscalCode";

import {
  handleNotification,
  index,
  sendToWebhook,
  WEBHOOK_NOTIFICATION_QUEUE_NAME
} from "../webhook_queue_handler";

import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { MessageSubject } from "../api/definitions/MessageSubject";
import { CreatedMessageEventSenderMetadata } from "../models/created_message_sender_metadata";
import { Notification, NotificationModel } from "../models/notification";
import { isTransient } from "../utils/errors";

import { NotificationEvent } from "../models/notification_event";

import * as functionConfig from "../../WebhookNotificationsQueueHandler/function.json";
import { MessageContent } from "../api/definitions/MessageContent";
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../api/definitions/NotificationChannelStatusValue";
import { TimeToLiveSeconds } from "../api/definitions/TimeToLiveSeconds";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  makeStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "../models/notification_status";

jest.mock("../utils/azure_queues");
import { handleQueueProcessingFailure } from "../utils/azure_queues";

import * as superagent from "superagent";

// as superagent does not export request methods directly
// we must override the superagent.Request prototype
// so we can set up our jest mock to use it instead
// of the send() method
const mockSuperagentResponse = (response: any) => {
  const sendMock = jest.fn();
  // tslint:disable-next-line:no-object-mutation
  (superagent as any).Request.prototype.send = sendMock;
  return sendMock.mockReturnValueOnce(Promise.resolve(response));
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aMessage = {
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: aMessageId,
  kind: "INewMessageWithoutContent",
  senderServiceId: "",
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aMessageContent = {
  markdown: `# Hello world!
    lorem ipsum
  `.repeat(10) as MessageBodyMarkdown
};

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;
const aMessageBodySubject = "t".repeat(30) as MessageSubject;

const aNotificationId = "A_NOTIFICATION_ID" as NonEmptyString;

const aSenderMetadata: CreatedMessageEventSenderMetadata = {
  departmentName: "dept" as NonEmptyString,
  organizationName: "org" as NonEmptyString,
  serviceName: "service" as NonEmptyString
};

const aNotificationEvent = {
  message: {
    ...aMessage,
    content: {
      markdown: aMessageBodyMarkdown,
      subject: aMessageBodySubject
    },
    kind: "INewMessageWithContent"
  },
  notificationId: aNotificationId,
  senderMetadata: aSenderMetadata
};

const getMockNotificationEvent = (
  messageContent: MessageContent = {
    markdown: aMessageBodyMarkdown,
    subject: aMessageBodySubject
  }
) => {
  return NotificationEvent.decode(
    Object.assign({}, aNotificationEvent, {
      message: {
        ...aNotificationEvent.message,
        content: messageContent
      }
    })
  ).getOrElseL(errs => {
    throw new Error(
      "Cannot deserialize NotificationEvent: " + readableReport(errs)
    );
  });
};

const aNotification: Notification = {
  channels: {
    [NotificationChannelEnum.WEBHOOK]: {
      url: process.env.WEBHOOK_CHANNEL_URL
    }
  },
  fiscalCode: aFiscalCode,
  messageId: aMessageId
};

const aRetrievedNotificationStatus: RetrievedNotificationStatus = {
  _self: "xyz",
  _ts: 123,
  channel: NotificationChannelEnum.WEBHOOK,
  id: "1" as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  messageId: aMessageId,
  notificationId: aNotificationId,
  status: NotificationChannelStatusValueEnum.SENT,
  statusId: makeStatusId(aNotificationId, NotificationChannelEnum.WEBHOOK),
  updatedAt: new Date(),
  version: 1 as NonNegativeNumber
};

describe("sendToWebhook", () => {
  it("should return a transient error in case of timeout", async () => {
    const sendMock = jest.fn();
    sendMock.mockImplementation(() => {
      return Promise.reject({ timeout: true });
    });
    // tslint:disable-next-line:no-object-mutation
    (superagent as any).Request.prototype.send = sendMock;
    const ret = await sendToWebhook({} as any, {} as any, {} as any);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(isLeft(ret)).toBeTruthy();
    if (isLeft(ret)) {
      expect(isTransient(ret.value)).toBeTruthy();
    }
  });
  it("should return a transient error in case the webhook returns HTTP status 5xx", async () => {
    const sendMock = jest.fn();
    sendMock.mockImplementation(() => {
      return Promise.reject({ status: 555 });
    });
    // tslint:disable-next-line:no-object-mutation
    (superagent as any).Request.prototype.send = sendMock;
    const ret = await sendToWebhook({} as any, {} as any, {} as any);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(isLeft(ret)).toBeTruthy();
    if (isLeft(ret)) {
      expect(isTransient(ret.value)).toBeTruthy();
    }
  });
  it("should return a permanent error in case the webhook returns HTTP status 4xx", async () => {
    const sendMock = jest.fn();
    sendMock.mockImplementation(() => {
      return Promise.reject({ status: 444 });
    });
    // tslint:disable-next-line:no-object-mutation
    (superagent as any).Request.prototype.send = sendMock;
    const ret = await sendToWebhook({} as any, {} as any, {} as any);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(isLeft(ret)).toBeTruthy();
    if (isLeft(ret)) {
      expect(isTransient(ret.value)).toBeFalsy();
    }
  });
});

describe("handleNotification", () => {
  it("should return a transient error when there's an error while retrieving the notification", async () => {
    const notificationModelMock = {
      find: jest.fn(() => left("error"))
    };

    const result = await handleNotification(
      {} as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(notificationModelMock.find).toHaveBeenCalledWith(
      aNotificationId,
      aMessageId
    );
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeTruthy();
    }
  });

  it("should return a transient error when the notification does not exist", async () => {
    const notificationModelMock = {
      find: jest.fn(() => right(none))
    };

    const result = await handleNotification(
      {} as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeTruthy();
    }
  });

  it("should return a permanent error when the notification does not contain the webhook url", async () => {
    const notificationModelMock = {
      find: jest.fn(() => right(some({})))
    };

    const result = await handleNotification(
      {} as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeFalsy();
    }
  });

  it("should forward a notification", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const notificationModelMock = {
      find: jest.fn(() => Promise.resolve(right(some(aNotification)))),
      update: jest.fn(() => Promise.resolve(right(some(aNotification))))
    };

    mockSuperagentResponse({ status: 200 });

    const result = await handleNotification(
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent)
    );

    expect(mockAppinsights.trackEvent).toHaveBeenCalledWith({
      name: "notification.webhook.delivery",
      properties: {
        messageId: aMessageId,
        notificationId: aNotificationId,
        success: "true",
        url: process.env.WEBHOOK_CHANNEL_URL
      }
    });

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should forward a notification with the provided subject", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const customSubject = "A custom subject" as MessageSubject;

    mockSuperagentResponse({ status: 200 });

    const aLongMessageContent = {
      markdown: aMessageBodyMarkdown,
      subject: customSubject
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aLongMessageContent)
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should respond with a permanent error when delivery fails", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    mockSuperagentResponse({
      error: "some error"
    });

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent)
    );

    expect(mockAppinsights.trackEvent).toHaveBeenCalledWith({
      name: "notification.webhook.delivery",
      properties: {
        messageId: aMessageId,
        notificationId: aNotificationId,
        success: "false",
        url: process.env.WEBHOOK_CHANNEL_URL
      }
    });

    expect(notificationModelMock.update).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeFalsy();
    }
  });
});

describe("webhookNotificationQueueHandlerIndex", () => {
  it("should fail on invalid message payload", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: {}
      },
      done: jest.fn(),
      log: jest.fn()
    };
    const winstonErrorSpy = jest.spyOn(winston, "error");
    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(winstonErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("should stop processing in case the message is expired", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: {
          ...aNotificationEvent,
          message: {
            ...aNotificationEvent.message,
            createdAt: new Date("2012-12-12")
          }
        }
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const statusSpy = jest
      .spyOn(NotificationStatusModel.prototype, "upsert")
      .mockReturnValue(Promise.resolve(right(none)));

    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(statusSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: NotificationChannelStatusValueEnum.EXPIRED
      }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("should retry (throw) on transient error updating message status to EXPIRED", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: {
          ...aNotificationEvent,
          message: {
            ...aNotificationEvent.message,
            createdAt: new Date("2012-12-12")
          }
        }
      },
      done: jest.fn(),
      log: jest.fn()
    };

    (handleQueueProcessingFailure as jest.Mock).mockImplementation(() => {
      throw new Error();
    });

    const statusSpy = jest
      .spyOn(NotificationStatusModel.prototype, "upsert")
      .mockReturnValue(Promise.resolve(left(new Error("err"))));

    expect.assertions(1);

    try {
      await index(contextMock as any);
    } catch {
      expect(statusSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: NotificationChannelStatusValueEnum.EXPIRED
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    }
  });

  it("should retry (throw) on transient error updating message status to SENT", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: aNotificationEvent
      },
      done: jest.fn(),
      log: jest.fn()
    };

    (handleQueueProcessingFailure as jest.Mock).mockImplementation(() => {
      throw new Error();
    });

    mockSuperagentResponse({ status: 200 });

    jest
      .spyOn(NotificationModel.prototype, "find")
      .mockImplementation(jest.fn(() => right(some(aNotification))));

    const statusSpy = jest
      .spyOn(NotificationStatusModel.prototype, "upsert")
      .mockReturnValue(Promise.resolve(left(new Error("err"))));

    expect.assertions(1);

    try {
      await index(contextMock as any);
    } catch {
      expect(statusSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: NotificationChannelStatusValueEnum.SENT
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    }
  });

  it("should proceed on valid message payload", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: aNotificationEvent
      },
      done: jest.fn(),
      log: jest.fn()
    };

    mockSuperagentResponse({ status: 200 });

    const notificationModelSpy = jest
      .spyOn(NotificationModel.prototype, "find")
      .mockImplementation(jest.fn(() => right(some(aNotification))));

    const notificationStatusModelSpy = jest
      .spyOn(NotificationStatusModel.prototype, "upsert")
      .mockImplementation(
        jest.fn(() => Promise.resolve(right(aRetrievedNotificationStatus)))
      );

    const ret = await index(contextMock as any);

    expect(notificationStatusModelSpy).toHaveBeenCalledTimes(1);
    expect(notificationModelSpy).toHaveBeenCalledTimes(1);
    expect(ret).toEqual(undefined);
  });
});

describe("webhookNotificationQueueHandler", () => {
  it("should set WEBHOOK_NOTIFICATION_QUEUE_NAME = queueName in functions.json trigger", async () => {
    const queueName = (functionConfig as any).bindings[0].queueName;
    expect(queueName).toEqual(WEBHOOK_NOTIFICATION_QUEUE_NAME);
  });
});
