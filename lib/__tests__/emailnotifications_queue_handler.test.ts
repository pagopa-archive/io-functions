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

import * as t from "io-ts";
import * as NodeMailer from "nodemailer";

import MockTransport = require("nodemailer-mock-transport");

import { none, Option, some, Some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { EmailString, NonEmptyString } from "../utils/strings";

import { FiscalCode } from "../api/definitions/FiscalCode";
import { NotificationChannelStatusEnum } from "../api/definitions/NotificationChannelStatus";

import {
  generateDocumentHtml,
  handleNotification,
  ProcessingError,
  ProcessingResult,
  processReject,
  processResolve,
  sendMail
} from "../emailnotifications_queue_handler";

import * as winston from "winston";
import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { MessageSubject } from "../api/definitions/MessageSubject";
import { ICreatedMessageEventSenderMetadata } from "../models/created_message_sender_metadata";
import {
  INotification,
  NotificationAddressSource
} from "../models/notification";
import { INotificationEvent } from "../models/notification_event";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aFiscalCode = _getO(
  t.validate("FRLFRC74E04B157I", FiscalCode).toOption()
);

const aNotification: INotification = {
  emailNotification: {
    addressSource: NotificationAddressSource.DEFAULT_ADDRESS,
    status: NotificationChannelStatusEnum.QUEUED,
    toAddress: _getO(t.validate("pinco@pallino.com", EmailString).toOption())
  },
  fiscalCode: aFiscalCode,
  messageId: _getO(t.validate("A_MESSAGE_ID", NonEmptyString).toOption())
};

const aSenderMetadata: ICreatedMessageEventSenderMetadata = {
  departmentName: _getO(t.validate("IT", NonEmptyString).toOption()),
  organizationName: _getO(t.validate("agid", NonEmptyString).toOption()),
  serviceName: _getO(t.validate("Test", NonEmptyString).toOption())
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
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      {} as any,
      {} as any
    );

    expect(notificationModelMock.find).toHaveBeenCalledWith(
      "A_NOTIFICATION_ID",
      "A_MESSAGE_ID"
    );
    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingError.TRANSIENT);
  });

  it("should return a transient error when the notification does not exist", async () => {
    const notificationModelMock = {
      find: jest.fn(() => right(none))
    };

    const result = await handleNotification(
      {} as any,
      {} as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      {} as any,
      {} as any
    );

    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingError.TRANSIENT);
  });

  it("should return a permanent error when the notification does not contain the email channel", async () => {
    const notificationModelMock = {
      find: jest.fn(() => right(some({})))
    };

    const result = await handleNotification(
      {} as any,
      {} as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      {} as any,
      {} as any
    );

    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingError.PERMANENT);
  });

  it("should send an email notification", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      bodyMarkdown: "# Hello world!"
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      aSenderMetadata
    );

    expect(mockTransport.sentMail.length).toBe(1);
    const sentMail = mockTransport.sentMail[0];
    expect(sentMail.data.from).toBe("no-reply@italia.it");
    expect(sentMail.data.to).toBe("pinco@pallino.com");
    expect(sentMail.data.messageId).toBe("A_MESSAGE_ID");
    expect(sentMail.data.subject).not.toBeUndefined();
    expect(sentMail.data.headers["X-Italia-Messages-MessageId"]).toBe(
      "A_MESSAGE_ID"
    );
    expect(sentMail.data.headers["X-Italia-Messages-NotificationId"]).toBe(
      "A_NOTIFICATION_ID"
    );
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
        addressSource: NotificationAddressSource.DEFAULT_ADDRESS,
        messageId: "A_MESSAGE_ID",
        notificationId: "A_NOTIFICATION_ID",
        success: "true",
        transport: "sendgrid"
      }
    });

    expect(notificationModelMock.update.mock.calls[0][0]).toBe(
      "A_NOTIFICATION_ID"
    );
    expect(notificationModelMock.update.mock.calls[0][1]).toBe("A_MESSAGE_ID");
    expect(
      notificationModelMock.update.mock.calls[0][2]({
        emailNotification: {}
      })
    ).toEqual({
      emailNotification: {
        status: NotificationChannelStatusEnum.SENT_TO_CHANNEL
      }
    });

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingResult.OK);
  });

  it("should send an email notification with the text version of the message", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      bodyMarkdown: `
# Hello world!

This is a *message* from the future!
`
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      aSenderMetadata
    );

    expect(
      String(mockTransport.sentMail[0].data.text).replace(/[ \n]+/g, "|")
    ).toBe(
      `agid
IT
Test

A new notification for you.

HELLO WORLD!
This is a message from the future!`.replace(/[ \n]+/g, "|")
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingResult.OK);
  });

  it("should send an email notification with the default subject", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      bodyMarkdown: "# Hello world!"
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      {} as any
    );

    expect(mockTransport.sentMail[0].data.subject).toBe(
      "A new notification for you."
    );

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingResult.OK);
  });

  it("should send an email notification with the provided subject", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      bodyMarkdown: "# Hello world!",
      subject: "A custom subject"
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      {} as any
    );

    expect(mockTransport.sentMail[0].data.subject).toBe("A custom subject");

    expect(isRight(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingResult.OK);
  });

  it("should respond with a transient error when email delivery fails", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = {
      send: jest.fn((_, cb) => cb("error"))
    };
    const mockTransporter = NodeMailer.createTransport(mockTransport as any);

    const aMessageContent = {
      bodyMarkdown: "# Hello world!"
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => right(some(aNotification)))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      {} as any
    );

    expect(mockAppinsights.trackEvent).toHaveBeenCalledWith({
      name: "notification.email.delivery",
      properties: {
        addressSource: NotificationAddressSource.DEFAULT_ADDRESS,
        messageId: "A_MESSAGE_ID",
        notificationId: "A_NOTIFICATION_ID",
        success: "false",
        transport: "sendgrid"
      }
    });

    expect(notificationModelMock.update).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingError.TRANSIENT);
  });

  it("should respond with a transient error when notification update fails", async () => {
    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const mockTransport = MockTransport();
    const mockTransporter = NodeMailer.createTransport(mockTransport);

    const aMessageContent = {
      bodyMarkdown: "# Hello world!"
    };

    const notificationModelMock = {
      find: jest.fn(() => right(some(aNotification))),
      update: jest.fn(() => left("error"))
    };

    const result = await handleNotification(
      mockTransporter,
      mockAppinsights as any,
      notificationModelMock as any,
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      aMessageContent as any,
      {} as any
    );

    expect(mockTransport.sentMail.length).toBe(1);

    expect(notificationModelMock.update.mock.calls[0][0]).toBe(
      "A_NOTIFICATION_ID"
    );
    expect(notificationModelMock.update.mock.calls[0][1]).toBe("A_MESSAGE_ID");
    expect(
      notificationModelMock.update.mock.calls[0][2]({
        emailNotification: {}
      })
    ).toEqual({
      emailNotification: {
        status: NotificationChannelStatusEnum.SENT_TO_CHANNEL
      }
    });

    expect(isLeft(result)).toBeTruthy();
    expect(result.value).toBe(ProcessingError.TRANSIENT);
  });
});
describe("test processResolve function", () => {
  it("should call context.done on success", async () => {
    const result = right({} as any);

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    processResolve(result as any, contextMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.done.mock.calls[0][0]).toBe(undefined);
  });
  it("should call context.done Transient on transient error", async () => {
    const result = left(ProcessingError.TRANSIENT);

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    processResolve(result as any, contextMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.done.mock.calls[0][0]).toBe("Transient");
  });
  it("should call context.done on permanent error", async () => {
    const result = left(ProcessingError.PERMANENT);

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    processResolve(result as any, contextMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.done.mock.calls[0][0]).toBe(undefined);
  });
});
describe("test processReject function", () => {
  it("should call context.done on error", async () => {
    const errorMock = {
      isRight: () => true
    };

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    const emailNotificationMock: INotificationEvent = {
      messageContent: {
        bodyMarkdown: _getO(
          t.validate("test".repeat(80), MessageBodyMarkdown).toOption()
        )
      },
      messageId: _getO(t.validate("xxx", NonEmptyString).toOption()),
      notificationId: _getO(t.validate("yyy", NonEmptyString).toOption()),
      senderMetadata: {
        departmentName: _getO(t.validate("aaa", NonEmptyString).toOption()),
        organizationName: _getO(t.validate("agid", NonEmptyString).toOption()),
        serviceName: _getO(t.validate("ccc", NonEmptyString).toOption())
      }
    };

    const spy = jest.spyOn(winston, "error");

    processReject(errorMock as any, contextMock as any, emailNotificationMock);

    expect(spy.mock.calls[0][0]).toEqual(
      `Error while processing event, retrying` +
        `|${emailNotificationMock.messageId}|${emailNotificationMock.notificationId}|${errorMock}`
    );
    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.done.mock.calls[0][0]).toEqual(errorMock);

    spy.mockReset();
    spy.mockRestore();
  });
});
describe("generate html document", () => {
  it("should convert markdown to the right html", async () => {
    const subject = _getO(
      t.validate("This is the subject", MessageSubject).toOption()
    );
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
`;
    const body = _getO(t.validate(markdown, MessageBodyMarkdown).toOption());
    const metadata: ICreatedMessageEventSenderMetadata = {
      departmentName: _getO(
        t.validate("departmentXXX", NonEmptyString).toOption()
      ),
      organizationName: _getO(
        t.validate("organizationXXX", NonEmptyString).toOption()
      ),
      serviceName: _getO(t.validate("serviceZZZ", NonEmptyString).toOption())
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
