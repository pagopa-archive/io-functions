// tslint:disable:no-any
// tslint:disable:no-null-keyword

import * as NodeMailer from "nodemailer";

import MockTransport = require("nodemailer-mock-transport");

import { none, some } from "ts-option";

import { left, right } from "../utils/either";
import { toEmailString, toNonEmptyString } from "../utils/strings";

import { toFiscalCode } from "../api/definitions/FiscalCode";
import { NotificationChannelStatus } from "../api/definitions/NotificationChannelStatus";

import {
  handleNotification,
  ProcessingError,
  ProcessingResult,
  sendMail
} from "../emailnotifications_queue_handler";

import { ICreatedMessageEventSenderMetadata } from "../models/created_message_sender_metadata";
import {
  INotification,
  NotificationAddressSource
} from "../models/notification";

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aNotification: INotification = {
  emailNotification: {
    addressSource: NotificationAddressSource.DEFAULT_ADDRESS,
    status: NotificationChannelStatus.QUEUED,
    toAddress: toEmailString("pinco@pallino.com").get
  },
  fiscalCode: aFiscalCode,
  messageId: toNonEmptyString("A_MESSAGE_ID").get
};

const aSenderMetadata: ICreatedMessageEventSenderMetadata = {
  departmentName: toNonEmptyString("IT").get,
  organizationName: toNonEmptyString("agid").get,
  serviceName: toNonEmptyString("Test").get
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

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe("ok");
    }
  });

  it("should call sendMail on the Transporter and return the error", async () => {
    const transporterMock = {
      sendMail: jest.fn((_, cb) => cb("error"))
    };

    const options = {};

    const result = await sendMail(transporterMock as any, options as any);

    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe("error");
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
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe(ProcessingError.TRANSIENT);
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
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      {} as any,
      {} as any
    );

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe(ProcessingError.TRANSIENT);
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
      "A_MESSAGE_ID",
      "A_NOTIFICATION_ID",
      {} as any,
      {} as any
    );

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe(ProcessingError.PERMANENT);
    }
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
        status: NotificationChannelStatus.SENT_TO_CHANNEL
      }
    });

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe(ProcessingResult.OK);
    }
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

Un nuovo avviso per te.

HELLO WORLD!
This is a message from the future!`.replace(/[ \n]+/g, "|")
    );

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe(ProcessingResult.OK);
    }
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
      "Un nuovo avviso per te."
    );

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe(ProcessingResult.OK);
    }
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

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toBe(ProcessingResult.OK);
    }
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

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe(ProcessingError.TRANSIENT);
    }
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
        status: NotificationChannelStatus.SENT_TO_CHANNEL
      }
    });

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe(ProcessingError.TRANSIENT);
    }
  });
});
