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
  MAILUP_SECRET: "anyMailupSecret",
  MAILUP_USERNAME: "anyMailupUser",
  MAIL_FROM_DEFAULT: "no-reply@italia.it",
  QueueStorageConnection: "anyConnectionString"
};

jest.mock("applicationinsights");
jest.mock("azure-storage");
jest.mock("io-functions-commons/dist/src/utils/mailup");

import * as NodeMailer from "nodemailer";
import * as winston from "winston";

import MockTransport = require("nodemailer-mock-transport");

import { none, some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { CreatedMessageEventSenderMetadata } from "io-functions-commons/dist/src/models/created_message_sender_metadata";
import {
  Notification,
  NotificationAddressSourceEnum,
  NotificationModel
} from "io-functions-commons/dist/src/models/notification";
import { isTransientError } from "io-functions-commons/dist/src/utils/errors";
import {
  EmailString,
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { NotificationEvent } from "io-functions-commons/dist/src/models/notification_event";

import { FiscalCode } from "../api/definitions/FiscalCode";

import {
  EMAIL_NOTIFICATION_QUEUE_NAME,
  generateDocumentHtml,
  handleNotification,
  index,
  INotificationDefaults,
  sendMail
} from "../emailnotifications_queue_handler";

import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { MessageSubject } from "../api/definitions/MessageSubject";

import * as functionConfig from "../../EmailNotificationsQueueHandler/function.json";
import { MessageContent } from "../api/definitions/MessageContent";
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../api/definitions/NotificationChannelStatusValue";
import { TimeToLiveSeconds } from "../api/definitions/TimeToLiveSeconds";

import {
  makeStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "io-functions-commons/dist/src/models/notification_status";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { readableReport } from "italia-ts-commons/lib/reporters";

jest.mock("../utils/azure_queues");
import { handleQueueProcessingFailure } from "../utils/azure_queues";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const getAppinsightsMock = () => ({
  trackDependency: jest.fn(),
  trackEvent: jest.fn()
});

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aMessage = {
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: aMessageId,
  indexedId: aMessageId,
  kind: "INewMessageWithoutContent",
  senderServiceId: "s123",
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;
const aMessageBodySubject = "t".repeat(30) as MessageSubject;

const aNotificationId = "A_NOTIFICATION_ID" as NonEmptyString;
const anOrganizationFiscalCode = "00000000000" as OrganizationFiscalCode;

const aSenderMetadata: CreatedMessageEventSenderMetadata = {
  departmentName: "dept" as NonEmptyString,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "org" as NonEmptyString,
  serviceName: "service" as NonEmptyString
};

const aNotificationEvent = {
  content: {
    markdown: aMessageBodyMarkdown,
    subject: aMessageBodySubject
  },
  message: aMessage,
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
      content: messageContent,
      message: aNotificationEvent.message
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
  _ts: 123,
  channel: NotificationChannelEnum.EMAIL,
  id: "1" as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  messageId: aMessageId,
  notificationId: aNotificationId,
  status: NotificationChannelStatusValueEnum.SENT,
  statusId: makeStatusId(aNotificationId, NotificationChannelEnum.EMAIL),
  updatedAt: new Date(),
  version: 1 as NonNegativeNumber
};

const notificationDefaults: INotificationDefaults = {
  HTML_TO_TEXT_OPTIONS: {
    ignoreImage: true, // ignore all document images
    tables: true
  },
  MAIL_FROM: "no-reply@italia.it" as NonEmptyString
};

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
      getMockNotificationEvent(),
      notificationDefaults
    );

    expect(notificationModelMock.find).toHaveBeenCalledWith(
      aNotificationId,
      aMessageId
    );
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransientError(result.value)).toBeTruthy();
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
      getMockNotificationEvent(),
      notificationDefaults
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransientError(result.value)).toBeTruthy();
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
      getMockNotificationEvent(),
      notificationDefaults
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransientError(result.value)).toBeFalsy();
    }
  });

  it("should send an email notification", async () => {
    const mockAppinsights = getAppinsightsMock();

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      markdown: `# Hello world!
        lorem ipsum
      `.repeat(10) as MessageBodyMarkdown,
      subject: aMessageBodySubject
    };

    const notificationModelMock = {
      find: jest.fn(() => Promise.resolve(right(some(aNotification)))),
      update: jest.fn(() => Promise.resolve(right(some(aNotification))))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent),
      notificationDefaults
    );

    expect(mockTransport.sentMail.length).toBe(1);
    const sentMail = mockTransport.sentMail[0];
    expect(sentMail.data.from).toBe(notificationDefaults.MAIL_FROM);
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

    expect(mockAppinsights.trackDependency).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "notification.email.delivery",
        properties: {
          addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
          transport: expect.anything()
        },
        success: true
      })
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should send an email notification with the text version of the message", async () => {
    const mockAppinsights = getAppinsightsMock();

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      markdown: `
# Hello world!

This is a *message* from the future!
This is a *message* from the future!
This is a *message* from the future!
This is a *message* from the future!
` as MessageBodyMarkdown,
      subject: aMessageBodySubject
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      getMockNotificationEvent(aMessageContent),
      notificationDefaults
    );

    expect(
      String(mockTransport.sentMail[0].data.text).replace(/[ \n]+/g, "|")
    ).toBe(
      `
org
dept
service

${aMessageBodySubject}

HELLO WORLD!
This is a message from the future!
This is a message from the future!
This is a message from the future!
This is a message from the future!`.replace(/[ \n]+/g, "|")
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should send an email notification with the provided subject", async () => {
    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);
    const mockAppinsights = getAppinsightsMock();

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
      getMockNotificationEvent(aMessageContent),
      notificationDefaults
    );

    expect(mockTransport.sentMail[0].data.subject).toBe(customSubject);

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBeDefined();
  });

  it("should respond with a transient error when email delivery fails", async () => {
    const mockAppinsights = getAppinsightsMock();

    const mockTransport = {
      send: jest.fn((_, cb) => cb("error")),
      transporter: { name: "transporter" }
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
      getMockNotificationEvent(),
      notificationDefaults
    );

    expect(mockAppinsights.trackDependency).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "notification.email.delivery",
        properties: {
          addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS
        },
        success: false
      })
    );

    expect(notificationModelMock.update).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(isTransientError(result.value)).toBeTruthy();
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
      organizationFiscalCode: anOrganizationFiscalCode,
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
    jest.spyOn(NodeMailer, "createTransport").mockReturnValue({
      sendMail: jest.fn((_, cb) => cb(null, "ok"))
    });

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

    jest.spyOn(NodeMailer, "createTransport").mockReturnValue({
      sendMail: jest.fn((_, cb) => cb(null, "ok")),
      transporter: { name: "transporter" }
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

    jest.spyOn(NodeMailer, "createTransport").mockReturnValue({
      sendMail: jest.fn((_, cb) => cb(null, "ok")),
      transporter: { name: "transporter" }
    });

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
        sendMail: jest.fn((_, cb) => cb(null, "ok")),
        transporter: { name: "transporter" }
      });

    const ret = await index(contextMock as any);

    expect(notificationStatusModelSpy).toHaveBeenCalledTimes(1);
    expect(notificationModelSpy).toHaveBeenCalledTimes(1);
    expect(nodemailerSpy).toHaveBeenCalledTimes(1);
    expect(ret).toEqual(undefined);
  });
});

describe("emailNotificationQueueHandler", () => {
  it("should set EMAIL_NOTIFICATION_QUEUE_NAME = queueName in functions.json trigger", async () => {
    const queueName = (functionConfig as any).bindings[0].queueName;
    expect(queueName).toEqual(EMAIL_NOTIFICATION_QUEUE_NAME);
  });
});
