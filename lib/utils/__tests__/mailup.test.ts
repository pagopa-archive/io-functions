// tslint:disable:no-let no-any
import * as t from "io-ts";

import * as request from "superagent";
import * as mockSuperagent from "superagent-mock";

import Mail = require("nodemailer/lib/mailer");

import * as nodemailer from "nodemailer";
import { ENDPOINTS, MailUpTransport, SmtpAuthInfo } from "../mailup";

// format required by nodemailer
const anEmailMessage: Mail.Options = {
  from: "<foo> foo@example.com",
  headers: {
    "X-Header": "value"
  },
  html: "lorem ipsum <b>html></b>",
  replyTo: "foobar@example.com",
  subject: "lorem ipsum",
  text: "lorem impsum",
  to: "<bar> bar@example.com"
};

// format required by MailUp APIs
const anEmailPayload = {
  ExtendedHeaders: [{ N: "X-Header", V: "value" }],
  From: { Email: "@foo", Name: "foo@example.com" },
  Html: { Body: "lorem ipsum <b>html></b>" },
  ReplyTo: "foobar@example.com",
  Subject: "lorem ipsum",
  Text: "lorem impsum",
  To: [{ Email: "@bar", Name: "bar@example.com" }]
};

const someCreds = t
  .validate(
    {
      Secret: "secret",
      Username: "username"
    },
    SmtpAuthInfo
  )
  .fold(() => {
    throw new Error("Invalid SMTP credentials");
  }, t.identity);

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
    const responseSpy = jest.fn();
    const requestSpy = jest.fn();
    const superagentMock = mockSuperagent(request, [
      {
        fixtures: (_: any, params: any) => {
          requestSpy(params);
          return aResponsePayload;
        },
        pattern: ENDPOINTS.sendTransactionalMail,
        post: (_: any, data: any) => {
          responseSpy(data);
          return { body: data };
        }
      }
    ]);

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(requestSpy).toHaveBeenCalledWith({
      ...anEmailPayload,
      User: someCreds
    });
    expect(responseSpy).toHaveBeenCalledWith(aResponsePayload);
    expect(response).toEqual(aResponsePayload);

    superagentMock.unset();
  });

  it("should fail on empty from address", async () => {
    const superagentMock = mockSuperagent(request, [
      {
        fixtures: (_: any, __: any) => {
          return aResponsePayload;
        },
        pattern: ENDPOINTS.sendTransactionalMail,
        post: (_: any, data: any) => {
          return { body: data };
        }
      }
    ]);

    aNodemailerTransporter
      .sendMail({
        ...anEmailMessage,
        from: undefined
      })
      .then(e => {
        expect(e).not.toBeDefined();
      })
      .catch(e => {
        expect(e).toBeInstanceOf(Error);
      });

    superagentMock.unset();
  });

  it("should fail on empty destination address", async () => {
    const superagentMock = mockSuperagent(request, [
      {
        fixtures: (_: any, __: any) => {
          return aResponsePayload;
        },
        pattern: ENDPOINTS.sendTransactionalMail,
        post: (_: any, data: any) => {
          return { body: data };
        }
      }
    ]);

    aNodemailerTransporter
      .sendMail({
        ...anEmailMessage,
        to: undefined
      })
      .then(e => {
        expect(e).not.toBeDefined();
      })
      .catch(e => {
        expect(e).toBeInstanceOf(Error);
      });

    superagentMock.unset();
  });

  it("should fail on API error", async () => {
    const superagentMock = mockSuperagent(request, [
      {
        pattern: ENDPOINTS.sendTransactionalMail,
        fixtures: (_: any, __: any) => {
          return { error: "500" };
        },
        post: (_: any, data: any) => {
          return { body: data };
        }
      }
    ]);

    aNodemailerTransporter
      .sendMail(anEmailMessage)
      .then(e => {
        expect(e).not.toBeDefined();
      })
      .catch(e => {
        expect(e).toBeInstanceOf(Error);
      });

    superagentMock.unset();
  });
});
