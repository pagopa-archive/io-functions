/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as t from "io-ts";

import * as winston from "winston";

import * as ApplicationInsights from "applicationinsights";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { getRequiredStringEnv } from "./utils/env";
import { ReadableReporter } from "./utils/validation_reporters";

import { IContext } from "azure-functions-types";

import * as NodeMailer from "nodemailer";
import * as sendGridTransport from "nodemailer-sendgrid-transport";

import * as HtmlToText from "html-to-text";

import { MessageBodyMarkdown } from "./api/definitions/MessageBodyMarkdown";
import { MessageContent } from "./api/definitions/MessageContent";
import { NotificationChannelStatusEnum } from "./api/definitions/NotificationChannelStatus";

import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import { Notification, NotificationModel } from "./models/notification";
import { NotificationEvent } from "./models/notification_event";

import { markdownToHtml } from "./utils/markdown";

import { MessageSubject } from "./api/definitions/MessageSubject";
import defaultEmailTemplate from "./templates/html/default";
import {
  isTransient,
  PermanentError,
  RuntimeError,
  TransientError
} from "./utils/errors";

import { retryMessageEnqueue } from "./utils/azure_queues";

import { createQueueService } from "azure-storage";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "notifications"
);

export const EMAIL_NOTIFICATION_QUEUE_NAME = "emailnotifications";
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

//
// setup NodeMailer
//

const sendgridKey = getRequiredStringEnv("CUSTOMCONNSTR_SENDGRID_KEY");

//
// options used when converting an HTML message to pure text
// see https://www.npmjs.com/package/html-to-text#options
//

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // ignore all document images
  tables: true
};

//
// Main function
//

/**
 * Input and output bindings for this function
 * see EmailNotificationsQueueHandler/function.json
 */
const ContextWithBindings = t.interface({
  bindings: t.partial({
    notificationEvent: NotificationEvent
  })
});

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & IContext;

/**
 * Generates the HTML for the email from the Markdown content and the subject
 */
export async function generateDocumentHtml(
  subject: MessageSubject,
  markdown: MessageBodyMarkdown,
  senderMetadata: CreatedMessageEventSenderMetadata
): Promise<string> {
  // converts the markdown body to HTML
  const bodyHtml = (await markdownToHtml.process(markdown)).toString();

  // compose the service name from the department name and the service name
  const senderServiceName = `${senderMetadata.departmentName}<br />${
    senderMetadata.serviceName
  }`;

  // wrap the generated HTML into an email template
  const documentHtml = defaultEmailTemplate(
    subject, // title
    "", // TODO: headline
    senderMetadata.organizationName, // organization name
    senderServiceName, // service name
    subject,
    bodyHtml,
    "" // TODO: footer
  );

  return documentHtml;
}

/**
 * Promise wrapper around Transporter#sendMail
 */
export async function sendMail(
  transporter: NodeMailer.Transporter,
  options: NodeMailer.SendMailOptions
): Promise<Either<Error, NodeMailer.SentMessageInfo>> {
  return new Promise<Either<Error, NodeMailer.SentMessageInfo>>(resolve => {
    transporter.sendMail(options, (err, res) => {
      const result: Either<Error, NodeMailer.SentMessageInfo> = err
        ? left(err)
        : right(res);
      resolve(result);
    });
  });
}

/**
 * Returns a copy of the Notification with the EmailNotification status as SENT
 */
function setEmailNotificationToSent(notification: Notification): Notification {
  const emailNotification = notification.emailNotification;

  // this should never happens
  if (!emailNotification) {
    return notification;
  }

  return {
    ...notification,
    emailNotification: {
      ...emailNotification,
      status: NotificationChannelStatusEnum.SENT_TO_CHANNEL
    }
  };
}

/**
 * Handles the notification logic.
 *
 * This function will fetch the notification data and its associated message.
 * It will then send the email.
 */
export async function handleNotification(
  mailerTransporter: NodeMailer.Transporter,
  appInsightsClient: ApplicationInsights.TelemetryClient,
  notificationModel: NotificationModel,
  messageId: string,
  notificationId: string,
  messageContent: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): Promise<Either<RuntimeError, NodeMailer.SentMessageInfo>> {
  // fetch the notification
  const errorOrMaybeNotification = await notificationModel.find(
    notificationId,
    messageId
  );

  if (isLeft(errorOrMaybeNotification)) {
    const error = errorOrMaybeNotification.value;
    // we got an error while fetching the notification
    return left(
      TransientError(
        `Error while fetching the notification|notification=${notificationId}|message=${messageId}|error=${
          error.code
        }`
      )
    );
  }

  const maybeNotification = errorOrMaybeNotification.value;

  if (isNone(maybeNotification)) {
    // it may happen that the object is not yet visible to this function due to latency?
    return left(
      TransientError(
        `Notification not found|notification=${notificationId}|message=${messageId}`
      )
    );
  }

  // we have the notification
  const notification = maybeNotification.value;

  const emailNotification = notification.emailNotification;
  if (!emailNotification) {
    // for some reason the notification is missing the email channel attributes
    // we will never be able to send an email for this notification
    return left(
      PermanentError(
        `The notification does not have email info|notification=${notificationId}|message=${messageId}`
      )
    );
  }

  // use the provided subject if present, or else use the default subject line
  // TODO: generate the default subject from the service/client metadata
  const subject = messageContent.subject
    ? messageContent.subject
    : ("A new notification for you." as MessageSubject);

  const documentHtml = await generateDocumentHtml(
    subject,
    messageContent.markdown,
    senderMetadata
  );

  // converts the HTML to pure text to generate the text version of the message
  const bodyText = HtmlToText.fromString(documentHtml, HTML_TO_TEXT_OPTIONS);

  // trigger email delivery
  // TODO: use fromAddress from the emailNotification object
  // TODO: make everything configurable via settings
  // see https://nodemailer.com/message/
  const sendResult = await sendMail(mailerTransporter, {
    from: "no-reply@italia.it",
    headers: {
      "X-Italia-Messages-MessageId": messageId,
      "X-Italia-Messages-NotificationId": notificationId
    },
    html: documentHtml,
    messageId,
    subject,
    text: bodyText,
    to: emailNotification.toAddress
    // priority: "high", // TODO: set based on kind of notification
    // disableFileAccess: true,
    // disableUrlAccess: true,
  });

  const eventName = "notification.email.delivery";
  const eventContent = {
    addressSource: emailNotification.addressSource,
    messageId,
    notificationId,
    transport: "sendgrid"
  };

  if (isLeft(sendResult)) {
    // track the event of failed delivery
    appInsightsClient.trackEvent({
      name: eventName,
      properties: {
        ...eventContent,
        success: "false"
      }
    });
    const error = sendResult.value;
    return left(
      TransientError(
        `Error while sending email|notification=${notificationId}|message=${messageId}|error=${
          error.message
        }`
      )
    );
  }

  // track the event of successful delivery
  appInsightsClient.trackEvent({
    name: eventName,
    properties: {
      ...eventContent,
      success: "true"
    }
  });

  // now we can update the notification status
  // TODO: store the message ID for handling bounces and delivery updates
  // see https://nodemailer.com/usage/#sending-mail
  // see #150597597
  const updateResult = await notificationModel.update(
    notificationId,
    messageId,
    setEmailNotificationToSent
  );

  if (isLeft(updateResult)) {
    // we got an error while updating the notification status
    // TODO: this will re-send the email, check whether the mailing provider
    // supports idempotent calls (dedup on notificationId)
    const error = updateResult.value;
    return left(
      TransientError(
        `Error while updating the notification|notification=${notificationId}|message=${messageId}|error=${
          error.code
        }`
      )
    );
  }

  // success!
  winston.debug(
    `EmailNotificationsHandlerIndex|Email notification succeeded|notification=${notificationId}|message=${messageId}`
  );
  return right(sendResult);
}

export function processResolve(
  errorOrResult: Either<RuntimeError, NodeMailer.SentMessageInfo>,
  context: IContext
): void {
  if (isLeft(errorOrResult)) {
    if (isTransient(errorOrResult.value)) {
      winston.warn(
        `EmailNotificationQueueHandler|Transient error|${
          errorOrResult.value.message
        }`
      );
      // transient error, we trigger a retry
      const queueService = createQueueService(queueConnectionString);
      return retryMessageEnqueue(
        queueService,
        EMAIL_NOTIFICATION_QUEUE_NAME,
        context
      );
    } else {
      winston.warn(
        `EmailNotificationQueueHandler|Permanent error|${
          errorOrResult.value.message
        }`
      );
    }
  }
  // TODO: update message status (succes_at / failed_at)
  // in case of permanent error or success we are done
  context.done();
}

/**
 * Function handler
 */
export function index(context: ContextWithBindings): void {
  try {
    const logLevel = isProduction ? "info" : "debug";
    configureAzureContextTransport(context, winston, logLevel);
    winston.debug(`STARTED|${context.invocationId}`);

    // Setup ApplicationInsights
    const appInsightsClient = new ApplicationInsights.TelemetryClient();

    // since this function gets triggered by a queued message that gets
    // deserialized from a json object, we must first check that what we
    // got is what we expect.
    const validation = NotificationEvent.decode(
      context.bindings.notificationEvent
    );
    if (isLeft(validation)) {
      winston.error(
        `EmailNotificationsHandlerIndex|Fatal! No valid email notification found in bindings.`
      );
      winston.debug(
        `EmailNotificationsHandlerIndex|validationError|${ReadableReporter.report(
          validation
        ).join("\n")}`
      );
      return context.done();
    }

    const emailNotificationEvent = validation.value;

    // it is an IEmailNotificationEvent
    winston.debug(
      `EmailNotificationsHandlerIndex|Dequeued email notification|${
        emailNotificationEvent.notificationId
      }`
    );

    // setup required models
    const documentClient = new DocumentDBClient(cosmosDbUri, {
      masterKey: cosmosDbKey
    });
    const notificationModel = new NotificationModel(
      documentClient,
      notificationsCollectionUrl
    );

    const mailerTransporter = NodeMailer.createTransport(
      sendGridTransport({
        auth: {
          api_key: sendgridKey
        }
      })
    );

    handleNotification(
      mailerTransporter,
      appInsightsClient,
      notificationModel,
      emailNotificationEvent.messageId,
      emailNotificationEvent.notificationId,
      emailNotificationEvent.messageContent,
      emailNotificationEvent.senderMetadata
    )
      .then(errorOrResult => {
        processResolve(errorOrResult, context);
      })
      .catch(error => {
        // Some unexpected exception occurred inside the promise.
        // We consider this event as a permanent unrecoverable error.
        // TODO: update message status (failed_at)
        winston.error(
          `EmailNotificationQueueHandler|Error while processing event` +
            `|${emailNotificationEvent.messageId}|${
              emailNotificationEvent.notificationId
            }|${error}`
        );
        context.done();
      });
  } catch (error) {
    // Avoid poison queue in case of unexpected errors
    // occurred outside handleNotification (shouldn't happen)
    // TODO: update message status (failed_at)
    winston.error(
      `EmailNotificationQueueHandler|Exception caught|${error.message}|${
        error.stack
      }`
    );
    context.done();
  }
}
