// tslint:disable:no-any
// tslint:disable:no-null-keyword

// set a dummy value for the env vars needed by the handler
// tslint:disable-next-line:no-object-mutation
process.env.CUSTOMCONNSTR_COSMOSDB_URI = "anyCosmosDbUri";
// tslint:disable-next-line:no-object-mutation
process.env.CUSTOMCONNSTR_COSMOSDB_KEY = "anyCosmosDbKey";
// tslint:disable-next-line:no-object-mutation
process.env.COSMOSDB_NAME = "anyDbName";
// tslint:disable-next-line:no-object-mutation
process.env.CUSTOMCONNSTR_SENDGRID_KEY = "anySendgridKey";
// tslint:disable-next-line:no-object-mutation
process.env.QueueStorageConnection = "anyConnectionString";

jest.mock("applicationinsights");
jest.mock("azure-storage");
jest.mock("nodemailer-sendgrid-transport");

// updateMessageVisibilityTimeout
jest.mock("../utils/azure_queues");

import * as NodeMailer from "nodemailer";
import * as winston from "winston";

import MockTransport = require("nodemailer-mock-transport");

import { isNone, none, some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { EmailString, NonEmptyString } from "../utils/strings";

import { FiscalCode } from "../api/definitions/FiscalCode";

import {
  EMAIL_NOTIFICATION_QUEUE_NAME,
  generateDocumentHtml,
  handleNotification,
  index,
  processGenericError,
  processRuntimeError,
  sendMail
} from "../emailnotifications_queue_handler";

import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { MessageSubject } from "../api/definitions/MessageSubject";
import { CreatedMessageEventSenderMetadata } from "../models/created_message_sender_metadata";
import {
  Notification,
  NotificationAddressSourceEnum,
  NotificationModel
} from "../models/notification";
import { isTransient, PermanentError, TransientError } from "../utils/errors";

import { NotificationEvent } from "../models/notification_event";

import * as functionConfig from "../../EmailNotificationsQueueHandler/function.json";
import { MessageContent } from "../api/definitions/MessageContent";
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../api/definitions/NotificationChannelStatusValue";
import { TimeToLiveSeconds } from "../api/definitions/TimeToLiveSeconds";
import { processSuccess } from "../emailnotifications_queue_handler";
import {
  makeStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "../models/notification_status";
import { updateMessageVisibilityTimeout } from "../utils/azure_queues";
import { NonNegativeNumber } from "../utils/numbers";
import { readableReport } from "../utils/validation_reporters";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
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
    [NotificationChannelEnum.EMAIL]: {
      addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
      toAddress: "pinco@pallino.com" as EmailString
    }
  },
  fiscalCode: aFiscalCode,
  messageId: aMessageId
};

const aRetrievedNotificationStatus: RetrievedNotificationStatus = {
  _self: "xyz",
  _ts: "xyz",
  channel: NotificationChannelEnum.EMAIL,
  id: "1" as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  messageId: aMessageId,
  notificationId: aNotificationId,
  status: NotificationChannelStatusValueEnum.SENT_TO_CHANNEL,
  statusId: makeStatusId(aNotificationId, NotificationChannelEnum.EMAIL),
  updateAt: new Date(),
  version: 1 as NonNegativeNumber
};

// function getUpdateNotificationStatusMock(
//   retrievedNotificationStatus: any = right(aRetrievedNotificationStatus)
// ): any {
//   return jest.fn(() => Promise.resolve(retrievedNotificationStatus));
// }

describe("sendMail", () => {
  it("should call sendMail on the Transporter and return the result", async () => {
    const transporterMock = {
      sendMail: jest.fn((_, cb) => cb(null, "ok"))
    };

    const options = {
      myopts: true
    };

    const result = await sendMail(transporterMock as any, options as any);

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);
    expect(transporterMock.sendMail.mock.calls[0][0]).toEqual(options);

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBe("ok");
  });

  it("should call sendMail on the Transporter and return the error", async () => {
    const transporterMock = {
      sendMail: jest.fn((_, cb) => cb("error"))
    };

    const options = {};

    const result = await sendMail(transporterMock as any, options as any);

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe("error");
  });
});

describe("handleNotification", () => {
  it("should return a transient error when there's an error while retrieving the notification", async () => {
    const notificationModelMock = {
      find: jest.fn(() => left("error"))
    };

    const result = await handleNotification(
      {} as any,
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
      {} as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeTruthy();
    }
  });

  it("should return a permanent error when the notification does not contain the email channel", async () => {
    const notificationModelMock = {
      find: jest.fn(() => right(some({})))
    };

    const result = await handleNotification(
      {} as any,
      {} as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeFalsy();
    }
  });

  it("should send an email notification", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      markdown: `# Hello world!
        lorem ipsum
      `.repeat(10) as MessageBodyMarkdown
    };

    const notificationModelMock = {
      find: jest.fn(() => Promise.resolve(right(some(aNotification)))),
      update: jest.fn(() => Promise.resolve(right(some(aNotification))))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent)
    );

    expect(mockTransport.sentMail.length).toBe(1);
    const sentMail = mockTransport.sentMail[0];
    expect(sentMail.data.from).toBe("no-reply@italia.it");
    expect(sentMail.data.to).toBe("pinco@pallino.com");
    expect(sentMail.data.messageId).toBe(aMessageId);
    expect(sentMail.data.subject).not.toBeUndefined();
    expect(sentMail.data.headers).not.toBeUndefined();
    if (sentMail.data.headers) {
      const headers = sentMail.data.headers as any;
      expect(headers["X-Italia-Messages-MessageId"]).toBe(aMessageId);
      expect(headers["X-Italia-Messages-NotificationId"]).toBe(aNotificationId);
    }
    const emailBody = String(sentMail.data.html);
    expect(emailBody.indexOf("<h1>Hello world!</h1>")).toBeGreaterThan(0);
    expect(emailBody.indexOf(aSenderMetadata.departmentName)).toBeGreaterThan(
      0
    );
    expect(emailBody.indexOf(aSenderMetadata.organizationName)).toBeGreaterThan(
      0
    );
    expect(emailBody.indexOf(aSenderMetadata.serviceName)).toBeGreaterThan(0);

    expect(mockAppinsights.trackEvent).toHaveBeenCalledWith({
      name: "notification.email.delivery",
      properties: {
        addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
        messageId: aMessageId,
        notificationId: aNotificationId,
        success: "true",
        transport: "sendgrid"
      }
    });

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should send an email notification with the text version of the message", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      markdown: `
# Hello world!

This is a *message* from the future!
This is a *message* from the future!
This is a *message* from the future!
This is a *message* from the future!
` as MessageBodyMarkdown
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent)
    );

    expect(
      String(mockTransport.sentMail[0].data.text).replace(/[ \n]+/g, "|")
    ).toBe(
      `org
dept
service

A new notification for you.

HELLO WORLD!
This is a message from the future!
This is a message from the future!
This is a message from the future!
This is a message from the future!`.replace(/[ \n]+/g, "|")
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should send an email notification with the default subject", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent({
        markdown: aMessageBodyMarkdown,
        subject: undefined
      })
    );

    expect(mockTransport.sentMail[0].data.subject).toBe(
      "A new notification for you."
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should send an email notification with the provided subject", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const customSubject = "A custom subject" as MessageSubject;

    const aMessageContent = {
      markdown: aMessageBodyMarkdown,
      subject: customSubject
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent)
    );

    expect(mockTransport.sentMail[0].data.subject).toBe(customSubject);

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should respond with a transient error when email delivery fails", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = {
      send: jest.fn((_, cb) => cb("error"))
    };
    const mockTransporter = NodeMailer.createTransport(mockTransport as any);

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent()
    );

    expect(mockAppinsights.trackEvent).toHaveBeenCalledWith({
      name: "notification.email.delivery",
      properties: {
        addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
        messageId: aMessageId,
        notificationId: aNotificationId,
        success: "false",
        transport: "sendgrid"
      }
    });

    expect(notificationModelMock.update).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransient(result.value)).toBeTruthy();
    }
  });
});

describe("generateHtmlDocument", () => {
  it("should convert markdown to the right html", async () => {
    const subject = "This is the subject" as MessageSubject;
    const markdown = `
# This is an H1
Lorem ipsum
## This is an H2
Lorem ipsum
###### This is an H6
Lorem ipsum
*   Red
*   Green
*   Blue
Lorem ipsum
1.  Bird
2.  McHale
3.  Parish
` as MessageBodyMarkdown;
    const body = markdown;
    const metadata: CreatedMessageEventSenderMetadata = {
      departmentName: "departmentXXX" as NonEmptyString,
      organizationName: "organizationXXX" as NonEmptyString,
      serviceName: "serviceZZZ" as NonEmptyString
    };

    const result = await generateDocumentHtml(subject, body, metadata);
    expect(result.indexOf("This is the subject")).toBeGreaterThan(0);
    expect(result.indexOf("departmentXXX")).toBeGreaterThan(0);
    expect(result.indexOf("organizationXXX")).toBeGreaterThan(0);
    expect(result.indexOf("serviceZZZ")).toBeGreaterThan(0);
    expect(result.indexOf("<h1>This is an H1</h1>")).toBeGreaterThan(0);
    expect(result.indexOf("<h2>This is an H2</h2>")).toBeGreaterThan(0);
    expect(result.indexOf("<h6>This is an H6</h6>")).toBeGreaterThan(0);
    expect(result.indexOf("<ul>\n<li>Red</li>")).toBeGreaterThan(0);
    expect(result.indexOf("<ol>\n<li>Bird</li>")).toBeGreaterThan(0);
  });
});

describe("emailnotificationQueueHandlerIndex", () => {
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
    const nodemailerSpy = jest
      .spyOn(NodeMailer, "createTransport")
      .mockReturnValue({
        sendMail: jest.fn((_, cb) => cb(null, "ok"))
      });
    const winstonErrorSpy = jest.spyOn(winston, "error");
    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(nodemailerSpy).not.toHaveBeenCalled();
    expect(winstonErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("should proceed on valid message payload", async () => {
    const contextMock = {
      bindings: {
        notificationEvent: aNotificationEvent
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const notificationModelSpy = jest
      .spyOn(NotificationModel.prototype, "find")
      .mockImplementation(jest.fn(() => right(some(aNotification))));

    const notificationStatusModelSpy = jest
      .spyOn(NotificationStatusModel.prototype, "upsert")
      .mockImplementation(
        jest.fn(() => Promise.resolve(right(aRetrievedNotificationStatus)))
      );

    const nodemailerSpy = jest
      .spyOn(NodeMailer, "createTransport")
      .mockReturnValue({
        sendMail: jest.fn((_, cb) => cb(null, "ok"))
      });

    const ret = await index(contextMock as any);

    expect(notificationStatusModelSpy).toHaveBeenCalledTimes(1);
    expect(notificationModelSpy).toHaveBeenCalledTimes(1);
    expect(nodemailerSpy).toHaveBeenCalledTimes(1);
    expect(ret).toEqual(undefined);
  });
});

describe("processSuccess", () => {
  it("should update notification status to SENT_TO_CHANNEL", async () => {
    const notificationStatusUpdaterMock = jest.fn();

    const result = await processSuccess(
      getMockNotificationEvent(),
      notificationStatusUpdaterMock
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(isNone(result.value)).toBeTruthy();
    }

    expect(notificationStatusUpdaterMock).toHaveBeenCalledWith(
      NotificationChannelStatusValueEnum.SENT_TO_CHANNEL
    );
  });
});

describe("processRuntimeError", () => {
  it("should retry on transient error", async () => {
    const notificationStatusUpdaterMock = jest.fn();
    const error = TransientError("err");
    const winstonSpy = jest.spyOn(winston, "warn");
    await processRuntimeError(
      {} as any,
      notificationStatusUpdaterMock,
      error as any,
      {} as any
    );
    expect(notificationStatusUpdaterMock).not.toHaveBeenCalled();
    expect(updateMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    expect(winstonSpy).toHaveBeenCalledTimes(1);
  });

  it("should fail in case of permament error", async () => {
    const notificationStatusUpdaterMock = jest.fn();
    const error = PermanentError("err");
    const winstonSpy = jest.spyOn(winston, "error");
    await processRuntimeError(
      {} as any,
      notificationStatusUpdaterMock,
      error as any,
      {} as any
    );
    expect(notificationStatusUpdaterMock).toHaveBeenCalledWith(
      NotificationChannelStatusValueEnum.FAILED
    );
    expect(updateMessageVisibilityTimeout).not.toHaveBeenCalled();
    expect(winstonSpy).toHaveBeenCalledTimes(1);
  });
});

describe("processGenericError", () => {
  it("should update notification status to FAILED", async () => {
    const notificationStatusUpdaterMock = jest.fn();
    const winstonSpy = jest.spyOn(winston, "error");
    await processGenericError(notificationStatusUpdaterMock, new Error());
    expect(notificationStatusUpdaterMock).toHaveBeenCalledWith(
      NotificationChannelStatusValueEnum.FAILED
    );
    expect(winstonSpy).toHaveBeenCalledTimes(1);
  });
});

describe("emailNotificationQueueHandler", () => {
  it("should set EMAIL_NOTIFICATION_QUEUE_NAME = queueName in functions.json trigger", async () => {
    const queueName = (functionConfig as any).bindings[0].queueName;
    expect(queueName).toEqual(EMAIL_NOTIFICATION_QUEUE_NAME);
  });
});
