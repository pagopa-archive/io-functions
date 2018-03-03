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
import { readableReport } from "./utils/validation_reporters";

import { IContext } from "azure-functions-types";

import * as NodeMailer from "nodemailer";
import * as sendGridTransport from "nodemailer-sendgrid-transport";

import * as HtmlToText from "html-to-text";

import { MessageBodyMarkdown } from "./api/definitions/MessageBodyMarkdown";

import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import { EmailNotification, NotificationModel } from "./models/notification";
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
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "./api/definitions/NotificationChannelStatusValue";
import {
  getNotificationStatusUpdater,
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel,
  NotificationStatusUpdater
} from "./models/notification_status";

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

const notificationStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_STATUS_COLLECTION_NAME
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
 * Handles the notification logic.
 *
 * This function will fetch the notification data and its associated message.
 * It will then send the email.
 */
export async function handleNotification(
  mailerTransporter: NodeMailer.Transporter,
  appInsightsClient: ApplicationInsights.TelemetryClient,
  notificationModel: NotificationModel,
  updateNotificationStatus: NotificationStatusUpdater,
  emailNotificationEvent: NotificationEvent
): Promise<Either<RuntimeError, NodeMailer.SentMessageInfo>> {
  const {
    messageId,
    notificationId,
    messageContent,
    senderMetadata
  } = emailNotificationEvent;

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

  const maybeEmailNotification = errorOrMaybeNotification.value;

  if (isNone(maybeEmailNotification)) {
    // it may happen that the object is not yet visible to this function due to latency
    // as the notification object is retrieved from database (?)
    return left(
      TransientError(
        `Notification not found|notification=${notificationId}|message=${messageId}`
      )
    );
  }

  const errorOrEmailNotification = EmailNotification.decode(
    maybeEmailNotification.value
  );

  if (isLeft(errorOrEmailNotification)) {
    const error = readableReport(errorOrEmailNotification.value);
    return left(
      PermanentError(
        `Wrong format for email notification|notification=${notificationId}|message=${messageId}|${error}`
      )
    );
  }

  const emailNotification = errorOrEmailNotification.value.channels.EMAIL;

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
  // TODO: handling bounces and delivery updates
  // see https://nodemailer.com/usage/#sending-mail
  // see #150597597

  const errorOrNotificationStatus = await updateNotificationStatus(
    NotificationChannelStatusValueEnum.SENT_TO_CHANNEL
  );

  if (isLeft(errorOrNotificationStatus)) {
    // Here we got an error while updating the notification status
    // TODO: this will re-send the email, check whether the mailing provider
    // supports idempotent calls (dedup on notificationId)
    const error = errorOrNotificationStatus.value;
    return left(
      TransientError(
        `Error while updating the notification status|notification=${notificationId}|message=${messageId}|error=${
          error.message
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
      // TODO: update notification status (FAILED)
      winston.warn(
        `EmailNotificationQueueHandler|Permanent error|${
          errorOrResult.value.message
        }`
      );
    }
  }
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
        `EmailNotificationsHandlerIndex|validationError|${readableReport(
          validation.value
        )}`
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

    const notificationStatusModel = new NotificationStatusModel(
      documentClient,
      notificationStatusCollectionUrl
    );

    const updateNotificationStatus = getNotificationStatusUpdater(
      notificationStatusModel,
      NotificationChannelEnum.EMAIL,
      emailNotificationEvent.messageId,
      emailNotificationEvent.notificationId
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
      updateNotificationStatus,
      emailNotificationEvent
    )
      .then(errorOrResult => {
        processResolve(errorOrResult, context);
      })
      .catch(error => {
        // Some unexpected exception occurred inside the promise.
        // We consider this event as a permanent unrecoverable error.
        // TODO: update notification status (failed)
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
    // TODO: update notification status (failed)
    winston.error(
      `EmailNotificationQueueHandler|Exception caught|${error.message}|${
        error.stack
      }`
    );
    context.done();
  }
}
