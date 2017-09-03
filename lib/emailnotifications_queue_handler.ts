/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { Either, left, right } from "./utils/either";

import { IContext } from "./azure-functions-types";

import * as NodeMailer from "nodemailer";
import * as sendGridTransport from "nodemailer-sendgrid-transport";

import { INotificationEvent, isNotificationEvent } from "./models/notification_event";

import { MessageModel } from "./models/message";
import { INotification, NotificationChannelStatus, NotificationModel } from "./models/notification";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

// TODO: read from env vars
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl("development");
const messagesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "messages");
const notificationsCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "notifications");

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
  readonly bindings: {
    readonly notificationEvent?: INotificationEvent;
  };
}

const enum ProcessingResult {
  OK,
}

/**
 * Bad things that can happen while we process the message
 */
const enum ProcessingError {

  // a transient error, e.g. database is not available
  TRANSIENT,

  // a permanent error, e.g. missing email data from the notification
  PERMANENT,

}

/**
 * Promise wrapper around Transporter#sendMail
 */
async function sendMail(
  transporter: NodeMailer.Transporter,
  options: NodeMailer.SendMailOptions,
): Promise<Either<Error, NodeMailer.SentMessageInfo>> {
  return new Promise<Either<Error, NodeMailer.SentMessageInfo>>((resolve) => {
    transporter.sendMail(options, (err, res) => {
      const result: Either<Error, NodeMailer.SentMessageInfo> = err ? left(err) : right(res);
      resolve(result);
    });
  });
}

/**
 * Returns a copy of the Notification with the EmailNotification status as SENT
 */
function setEmailNotificationSend(notification: INotification): INotification {
  const emailNotification = notification.emailNotification;

  if (!emailNotification) {
    return notification;
  }

  return {
    ...notification,
    emailNotification: {
      ...emailNotification,
      status: NotificationChannelStatus.NOTIFICATION_SENT_TO_CHANNEL,
    },
  };

}

/**
 * Handles the notification logic.
 *
 * This function will fetch the notification data and its associated message.
 * It will then send the email.
 */
async function handleNotification(
  notificationModel: NotificationModel,
  messageModel: MessageModel,
  messageId: string,
  notificationId: string,
): Promise<Either<ProcessingError, ProcessingResult>> {

  // fetch the notification
  const errorOrNotification = await notificationModel.findNotification(messageId, notificationId);

  if (errorOrNotification.isLeft) {
    // we got an error while fetching the notification
    return left(ProcessingError.TRANSIENT);
  }

  // we have the notification
  const notification = errorOrNotification.right;

  const emailNotification = notification.emailNotification;
  if (!emailNotification) {
    // for some reason the notification is missing the email channel attributes
    // we will never be able to send an email for this notification
    return left(ProcessingError.PERMANENT);
  }

  // fetch the message
  const errorOrMessage = await messageModel.findMessage(notification.fiscalCode, notification.messageId);

  if (errorOrMessage.isLeft) {
    // we got an error while fetching the message
    return left(ProcessingError.TRANSIENT);
  }

  const message = errorOrMessage.right;

  // trigger email delivery
  // TODO: use fromAddress from the emailNotification object
  // TODO: make everything configurable via settings
  // TODO: provide alternative versions (html, text, markdown, ical)
  // see https://nodemailer.com/message/
  const sendResult = await sendMail(mailerTransporter, {
    from: "no-reply@italia.it",
    headers: [{
      "X-Italia-Messages-MessageId": message.id,
      "X-Italia-Messages-NotificationId": notification.id,
    }],
    html: message.bodyShort,
    messageId: message.id,
    subject: "Un nuovo avviso per te.",
    text: message.bodyShort,
    to: emailNotification.toAddress,
    // priority: "high", // TODO: set based on kind of notification
    // disableFileAccess: true,
    // disableUrlAccess: true,
  });

  if (sendResult.isLeft) {
    // we got an error while sending the email
    return left(ProcessingError.TRANSIENT);
  }

  // now we can update the notification status
  // TODO: store the message ID for handling bounces and delivery updates
  // see https://nodemailer.com/usage/#sending-mail
  // see #150597597
  const updateResult = await notificationModel.updateNotification(
    message.id, notification.id, setEmailNotificationSend,
  );

  if (updateResult.isLeft) {
    // we got an error while updating the notification status
    // TODO: this will re-send the email, check whether sendgrid supports idempotent calls (dedup on notificationId)
    return left(ProcessingError.TRANSIENT);
  }

  // success!
  return right(ProcessingResult.OK);
}

/**
 * Function handler
 */
export function index(context: IContextWithBindings): void {

  const emailNotificationEvent = context.bindings.notificationEvent;

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (emailNotificationEvent === undefined && !isNotificationEvent(emailNotificationEvent)) {
    context.log.error(`Fatal! No valid email notification found in bindings.`);
    context.done();
    return;
  }
  // it is an IEmailNotificationEvent
  context.log(`Dequeued email notification|${emailNotificationEvent.notificationId}`);

  // setup required models
  const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });
  const notificationModel = new NotificationModel(documentClient, notificationsCollectionUrl);
  const messageModel = new MessageModel(documentClient, messagesCollectionUrl);

  handleNotification(
    notificationModel,
    messageModel,
    emailNotificationEvent.messageId,
    emailNotificationEvent.notificationId,
  ).then((result) => {
    if (result.isLeft) {
      // if handler returned an error, decide what to do
      switch (result.left) {
        case ProcessingError.TRANSIENT: {
          // transient error, we trigger a retry
          context.done("Transient");
          break;
        }
        case ProcessingError.PERMANENT: {
          // permanent error, we're done
          context.done();
          break;
        }
      }
      return;
    }

    // success!
    context.done();
  }, (error) => {
    // the promise failed
    context.log.error(
      `Error while processing event, retrying` +
      `|${emailNotificationEvent.messageId}|${emailNotificationEvent.notificationId}|${error}`,
    );
    // in case of error, we return a failure to trigger a retry (up to the configured max retries)
    // TODO: schedule next retry with exponential backoff, see #150597257
    context.done(error);
  });

}
