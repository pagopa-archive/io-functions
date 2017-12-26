/**
 * Implements a Nodemailer MailUp transport.
 *
 * Uses the MailUp REST API to send transactional emails:
 * see http://help.mailup.com/display/mailupapi/Transactional+Emails+using+APIs
 *
 */
import * as t from "io-ts";
import * as request from "superagent";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { EmailString, NonEmptyString } from "./strings";

import * as nodemailer from "nodemailer";

import { Address as NodemailerAddress } from "nodemailer/lib/addressparser";

import * as winston from "winston";

import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { ReadableReporter } from "./validation_reporters";

// request timeout in milliseconds
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// number of retries in case of HTTP errors
const DEFAULT_REQUEST_RETRIES = 2;

export const ENDPOINTS = {
  sendTransactionalMail: "https://send.mailup.com/API/v2.0/messages/sendmessage"
};

type HttpMethod = "GET" | "POST";

const TRANSPORT_NAME = "MailUp";
const TRANSPORT_VERSION = "0.1";

/**
 * You need to create a SMTP+ user in MailUp administration panel
 */
export const SmtpAuthInfo = t.interface({
  Secret: NonEmptyString,
  Username: NonEmptyString
});

export type SmtpAuthInfo = t.TypeOf<typeof SmtpAuthInfo>;

/**
 * MailUp API calls common response fields
 */
const ApiResponse = t.interface({
  Code: t.string,
  Message: t.string,
  Status: t.string
});

type ApiResponse = t.TypeOf<typeof ApiResponse>;

const Address = t.interface({
  Email: EmailString,
  Name: t.string
});

type Address = t.TypeOf<typeof Address>;

const NameValue = t.interface({
  N: NonEmptyString,
  V: t.string
});

type NameValue = t.TypeOf<typeof NameValue>;

const Html = t.interface({
  Body: NonEmptyString
});

type Html = t.TypeOf<typeof NameValue>;

const EmailPayload = t.intersection([
  t.interface({
    ExtendedHeaders: t.array(NameValue),
    From: Address,
    Html,
    Subject: NonEmptyString,
    Text: NonEmptyString,
    To: t.array(Address)
  }),
  t.partial({
    Bcc: t.array(Address),
    Cc: t.array(Address),
    ReplyTo: t.string
  })
]);

type EmailPayload = t.TypeOf<typeof EmailPayload>;

export interface IMailUpTransportOptions {
  readonly creds: SmtpAuthInfo;
}

interface IAddresses {
  readonly bcc?: ReadonlyArray<NodemailerAddress>;
  readonly cc?: ReadonlyArray<NodemailerAddress>;
  readonly from?: ReadonlyArray<NodemailerAddress>;
  readonly sender?: ReadonlyArray<NodemailerAddress>;
  readonly "reply-to"?: ReadonlyArray<NodemailerAddress>;
  readonly to?: ReadonlyArray<NodemailerAddress>;
}

function callMailUpApi(
  method: HttpMethod,
  url: string,
  creds: SmtpAuthInfo,
  payload: {}
): Promise<Either<Error, ApiResponse>> {
  return request(method, url)
    .timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    .send({ ...payload, User: creds })
    .retry(DEFAULT_REQUEST_RETRIES)
    .then(response => {
      if (response.error) {
        return left<Error, ApiResponse>(
          new Error(
            `Error calling MailUp API: ${response.status} - ${response.text}`
          )
        );
      }
      return right<Error, ApiResponse>(response.body);
    })
    .catch(err => left<Error, ApiResponse>(new Error(err.response)));
}

async function sendTransactionalMail(
  creds: SmtpAuthInfo,
  payload: EmailPayload
): Promise<Either<Error, ApiResponse>> {
  const errorOrResponse = await callMailUpApi(
    "POST",
    ENDPOINTS.sendTransactionalMail,
    creds,
    payload
  );
  if (isLeft(errorOrResponse)) {
    return errorOrResponse;
  } else {
    const response = errorOrResponse.value;
    if (response.Code === "0") {
      return right(response);
    } else {
      return left(
        new Error(
          `Error while sending email: ${response.Code} - ${response.Message}`
        )
      );
    }
  }
}

function toMailupAddresses(
  addresses: ReadonlyArray<NodemailerAddress> | undefined
): Option<ReadonlyArray<Address>> {
  return Array.isArray(addresses) && addresses.length > 0
    ? some(
        addresses.map((address: NodemailerAddress) => {
          return {
            Name: address.name || address.address,
            Email: t.validate(address.address, EmailString).fold(() => {
              // this never happens as nodemailer has already parsed the address
              throw new Error(
                `Error while parsing email address (toMailupAddresses): invalid format '${
                  address.address
                }'.`
              );
            }, t.identity)
          };
        })
      )
    : none;
}

function toMailupAddress(
  addresses: ReadonlyArray<NodemailerAddress> | undefined
): Option<Address> {
  const addrs = toMailupAddresses(addresses).toUndefined();
  return addrs ? fromNullable(addrs[0]) : none;
}

/**
 * Nodemailer transport for MailUp transactional APIs
 *
 * see http://help.mailup.com/display/mailupapi/Transactional+Emails+using+APIs
 * and https://nodemailer.com/plugins/create/#transports
 *
 * Usage:
 *
 * const transporter = nodemailer.createTransport(
 *   MailUpTransport({
 *     creds: {
 *       Username: <SMPT+Username>,
 *       Secret: <SMPT+Password>
 *     }
 *   })
 * );
 *
 * transporter
 *   .sendMail({
 *     from:      "foobar@xexample.com",
 *     to:        "deadbeef@xexample.com",
 *     replyTo:   "foobar-reply@xexample.com",
 *     subject:   "lorem ipsum",
 *     text:      "lorem ipsum",
 *     html:      "<b>lorem ipsum</b>"
 *   })
 *   .then(res => console.log(JSON.stringify(res)))
 *   .catch(err => console.error(JSON.stringify(err)));
 */
export function MailUpTransport(
  options: IMailUpTransportOptions
): nodemailer.Transport {
  return {
    name: TRANSPORT_NAME,

    version: TRANSPORT_VERSION,

    send: async (mail, callback) => {
      // We don't use mail.data.from / mail.data.to as they are not parsed.
      // The following cast exists because of a bug in nodemailer typings.
      const addresses: IAddresses = mail.message.getAddresses() as IAddresses;

      // To convert nodemailer streams to strings:
      //  const resolveContent = promisify.typed(mail.resolveContent);
      //  const text = await resolveContent(mail.data, "text");
      //  const html = await resolveContent(mail.data, "html");

      const headers = Object.keys(mail.data.headers as {
        readonly [s: string]: string;
      }).map(header => ({
        N: header,
        // tslint:disable-next-line:no-any
        V: (mail.data.headers as any)[header]
      }));

      const replyTo = toMailupAddress(addresses["reply-to"]).toUndefined();

      const emailPayload = {
        Bcc: toMailupAddresses(addresses.bcc).toUndefined(),
        Cc: toMailupAddresses(addresses.cc).toUndefined(),
        ExtendedHeaders: headers,
        From: toMailupAddress(addresses.from).toUndefined(),
        Html: {
          Body: mail.data.html
        },
        ReplyTo: replyTo ? replyTo.Email : undefined,
        Subject: mail.data.subject,
        Text: mail.data.text,
        To: toMailupAddresses(addresses.to).toUndefined()
      };

      const errorOrEmail = t.validate(emailPayload, EmailPayload);

      if (isLeft(errorOrEmail)) {
        const errors = ReadableReporter.report(errorOrEmail).join("; ");
        winston.debug("MailUpTransport|errors", errors);
        return callback(
          new Error(`Invalid email payload: ${errors}`),
          undefined
        );
      }

      const email = errorOrEmail.value;

      winston.debug("MailUpTransport|email|", JSON.stringify(email));

      const errorOrResponse = await sendTransactionalMail(options.creds, email);

      if (isRight(errorOrResponse)) {
        // tslint:disable-next-line:no-null-keyword
        return callback(null, {
          ...errorOrResponse.value,
          messageId: mail.data.messageId
        });
      } else {
        return callback(errorOrResponse.value, undefined);
      }
    }
  };
}
