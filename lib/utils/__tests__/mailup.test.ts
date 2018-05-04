// tslint:disable:no-any

import Mail = require("nodemailer/lib/mailer");

import * as nodemailer from "nodemailer";

import * as request from "superagent";

import { MailUpTransport, SmtpAuthInfo } from "../mailup";

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

const mockSuperagentResponse = (response: any) =>
  // tslint:disable-next-line:no-object-mutation
  (Object.getPrototypeOf(request("", "")).send = jest.fn()).mockReturnValueOnce(
    Promise.resolve(response)
  );

// format required by nodemailer
const anEmailMessage: Mail.Options = {
  from: "foo <foo@example.com>",
  headers: {
    "X-Header": "value"
  },
  html: "lorem ipsum <b>html></b>",
  replyTo: "foobar@example.com",
  subject: "lorem ipsum",
  text: "lorem impsum",
  to: "bar <bar@example.com>"
};

// format required by MailUp APIs
const anEmailPayload = {
  ExtendedHeaders: [{ N: "X-Header", V: "value" }],
  From: { Email: "foo@example.com", Name: "foo" },
  Html: { Body: "lorem ipsum <b>html></b>" },
  ReplyTo: "foobar@example.com",
  Subject: "lorem ipsum",
  Text: "lorem impsum",
  To: [{ Email: "bar@example.com", Name: "bar" }]
};

const someCreds = SmtpAuthInfo.decode({
  Secret: "secret",
  Username: "username"
}).getOrElseL(() => {
  throw new Error("Invalid SMTP credentials");
});

const aResponsePayload = {
  Code: "0",
  Message: "",
  Status: "200"
};

const aNodemailerTransporter = nodemailer.createTransport(
  MailUpTransport({
    creds: someCreds
  })
);

describe("sendMail", () => {
  it("should get a success response from the API endpoint", async () => {
    const requestSpy = mockSuperagentResponse({
      body: aResponsePayload,
      status: 200
    });

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(requestSpy).toHaveBeenCalledWith({
      ...anEmailPayload,
      User: someCreds
    });
    expect(response).toEqual(aResponsePayload);
  });

  it("should fail on empty from address", async () => {
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        from: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on malformed email payload", async () => {
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        subject: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on empty destination address", async () => {
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        to: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on API error", async () => {
    mockSuperagentResponse({
      body: aResponsePayload,
      error: "500",
      status: 500
    });
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});
