/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import * as NodeMailer from "nodemailer";
import * as sendGridTransport from "nodemailer-sendgrid-transport";

import { IEmailNotificationEvent, isIEmailNotificationEvent } from "./models/email_notification_event";

//
// setup NodeMailer
//

const SENDGRID_KEY: string = process.env.CUSTOMCONNSTR_SENDGRID_KEY;

const mailerTransporter = NodeMailer.createTransport(sendGridTransport({
  auth: {
    api_key: SENDGRID_KEY,
  },
}));

//
// Main function
//

/**
 * Input and output bindings for this function
 * see EmailNotificationsQueueHandler/function.json
 */
interface IContextWithBindings extends IContext {
  bindings: {
    emailNotification?: IEmailNotificationEvent;
  };
}

/**
 * Function handler
 */
export function index(context: IContextWithBindings) {
  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (context.bindings.emailNotification != null && isIEmailNotificationEvent(context.bindings.emailNotification)) {
    // it is an IEmailNotificationEvent
    const emailNotificationEvent = context.bindings.emailNotification;
    context.log(`Dequeued email notification|${emailNotificationEvent.message.fiscalCode}`);

    // collect the message and the recipient addresses
    const message = emailNotificationEvent.message;
    const emailTo = emailNotificationEvent.recipients.join(",");

    context.log.verbose(`Sending email|${emailTo}|${message.bodyShort}`);

    // trigger email delivery
    // TODO: make everything configurable via settings
    // TODO: provide alternative versions (html, text, markdown, ical)
    // see https://nodemailer.com/message/
    mailerTransporter.sendMail({
      from: "no-reply@italia.it",
      html: message.bodyShort,
      subject: "Un nuovo avviso per te.",
      text: message.bodyShort,
      to: emailNotificationEvent.recipients.join(","),
      // priority: "high", // TODO: set based on kind of notification
      // disableFileAccess: true,
      // disableUrlAccess: true,
    }, (err, info) => {
      if (err) {
        context.log.error(`Error sending email|${err}`);
        context.done(err);
      } else {
        // TODO: store the message ID for handling bounces and delivery updates
        // see https://nodemailer.com/usage/#sending-mail
        context.log.verbose(`Email sent|${info}`);
        context.done();
      }
    });

  } else {
    context.log.error(`Fatal! No valid email notification found in bindings.`);
    context.done();
  }
}
