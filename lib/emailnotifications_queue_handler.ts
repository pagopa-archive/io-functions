/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as t from "io-ts";

import * as winston from "winston";

import { configureAzureContextTransport } from "io-functions-commons/dist/src/utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { Context } from "@azure/functions";

import { MailUpTransport } from "io-functions-commons/dist/src/utils/mailup";
import * as NodeMailer from "nodemailer";

import * as HtmlToText from "html-to-text";

import { MessageBodyMarkdown } from "./api/definitions/MessageBodyMarkdown";

import { CreatedMessageEventSenderMetadata } from "io-functions-commons/dist/src/models/created_message_sender_metadata";
import {
  EmailNotification,
  NOTIFICATION_COLLECTION_NAME,
  NotificationModel
} from "io-functions-commons/dist/src/models/notification";
import { NotificationEvent } from "io-functions-commons/dist/src/models/notification_event";

import { markdownToHtml } from "io-functions-commons/dist/src/utils/markdown";

import {
  ExpiredError,
  isExpiredError,
  PermanentError,
  RuntimeError,
  TransientError
} from "io-functions-commons/dist/src/utils/errors";
import { MessageSubject } from "./api/definitions/MessageSubject";
import defaultEmailTemplate from "./templates/html/default";

import { handleQueueProcessingFailure } from "./utils/azure_queues";

import { createQueueService } from "azure-storage";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "./api/definitions/NotificationChannelStatusValue";

import { TelemetryClient } from "applicationinsights";
import { ActiveMessage } from "io-functions-commons/dist/src/models/message";
import {
  getNotificationStatusUpdater,
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel
} from "io-functions-commons/dist/src/models/notification_status";
import {
  diffInMilliseconds,
  wrapCustomTelemetryClient
} from "io-functions-commons/dist/src/utils/application_insights";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import * as SendgridTransport from "nodemailer-sendgrid-transport";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

const getCustomTelemetryClient = wrapCustomTelemetryClient(
  isProduction,
  new TelemetryClient()
);

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_COLLECTION_NAME
);

const notificationStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_STATUS_COLLECTION_NAME
);

export const EMAIL_NOTIFICATION_QUEUE_NAME = "emailnotifications";
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

// We create the db client, services and models here
// as if any error occurs during the construction of these objects
// that would be unrecoverable anyway and we neither may trig a retry
const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const notificationStatusModel = new NotificationStatusModel(
  documentClient,
  notificationStatusCollectionUrl
);

const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

// As we cannot use Functions bindings to do retries,
// we resort to update the message visibility timeout
// using the queue service (client for Azure queue storage)
const queueService = createQueueService(queueConnectionString);

//
// setup NodeMailer
//
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

//
//  setup SendGrid
//
const useSendgridTransport = process.env.USE_SENDGRID_TRANSPORT;
const sendgridApiKey = useSendgridTransport
  ? getRequiredStringEnv("SENDGRID_API_KEY")
  : undefined;

//
// options used when converting an HTML message to pure text
// see https://www.npmjs.com/package/html-to-text#options
//

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // ignore all document images
  tables: true
};

// default sender for email
const MAIL_FROM = getRequiredStringEnv("MAIL_FROM_DEFAULT");

export interface INotificationDefaults {
  readonly HTML_TO_TEXT_OPTIONS: HtmlToTextOptions;
  readonly MAIL_FROM: NonEmptyString;
}

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

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & Context;

type OutputBindings = never;

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

  // strip leading zeroes
  const organizationFiscalCode = senderMetadata.organizationFiscalCode.replace(
    /^0+/,
    ""
  );

  // wrap the generated HTML into an email template
  return defaultEmailTemplate(
    subject, // title
    "", // TODO: headline
    senderMetadata.organizationName, // organization name
    senderServiceName, // service name
    organizationFiscalCode,
    subject,
    bodyHtml,
    "" // TODO: footer
  );
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
  lMailerTransporter: NodeMailer.Transporter,
  lAppInsightsClient: TelemetryClient,
  lNotificationModel: NotificationModel,
  emailNotificationEvent: NotificationEvent,
  notificationDefaultParams: INotificationDefaults
): Promise<Either<RuntimeError, NotificationEvent>> {
  const {
    message,
    content,
    notificationId,
    senderMetadata
  } = emailNotificationEvent;

  // Check if the message is not expired
  const errorOrActiveMessage = ActiveMessage.decode(message);

  if (isLeft(errorOrActiveMessage)) {
    // if the message is expired no more processing is necessary
    return left<RuntimeError, NotificationEvent>(
      ExpiredError(
        `Message expired|notification=${notificationId}|message=${message.id}`
      )
    );
  }

  // fetch the notification
  const errorOrMaybeNotification = await lNotificationModel.find(
    notificationId,
    message.id
  );

  if (isLeft(errorOrMaybeNotification)) {
    const error = errorOrMaybeNotification.value;
    // we got an error while fetching the notification
    return left<RuntimeError, NotificationEvent>(
      TransientError(
        `Error while fetching the notification|notification=${notificationId}|message=${
          message.id
        }|error=${error.code}`
      )
    );
  }

  const maybeEmailNotification = errorOrMaybeNotification.value;

  if (isNone(maybeEmailNotification)) {
    // it may happen that the object is not yet visible to this function due to latency
    // as the notification object is retrieved from database (?)
    return left<RuntimeError, NotificationEvent>(
      TransientError(
        `Notification not found|notification=${notificationId}|message=${
          message.id
        }`
      )
    );
  }

  const errorOrEmailNotification = EmailNotification.decode(
    maybeEmailNotification.value
  );

  if (isLeft(errorOrEmailNotification)) {
    const error = readableReport(errorOrEmailNotification.value);
    return left<RuntimeError, NotificationEvent>(
      PermanentError(
        `Wrong format for email notification|notification=${notificationId}|message=${
          message.id
        }|${error}`
      )
    );
  }

  const emailNotification = errorOrEmailNotification.value.channels.EMAIL;

  const documentHtml = await generateDocumentHtml(
    content.subject,
    content.markdown,
    senderMetadata
  );

  // converts the HTML to pure text to generate the text version of the message
  const bodyText = HtmlToText.fromString(
    documentHtml,
    notificationDefaultParams.HTML_TO_TEXT_OPTIONS
  );

  const startSendMailCallTime = process.hrtime();

  // trigger email delivery
  // see https://nodemailer.com/message/
  const sendResult = await sendMail(lMailerTransporter, {
    from: notificationDefaultParams.MAIL_FROM,
    headers: {
      "X-Italia-Messages-MessageId": message.id,
      "X-Italia-Messages-NotificationId": notificationId
    },
    html: documentHtml,
    messageId: message.id,
    subject: content.subject,
    text: bodyText,
    to: emailNotification.toAddress
    // priority: "high", // TODO: set based on kind of notification
    // disableFileAccess: true,
    // disableUrlAccess: true,
  });

  const sendMailCallDurationMs = diffInMilliseconds(startSendMailCallTime);

  const eventName = "notification.email.delivery";

  const eventContent = {
    dependencyTypeName: "HTTP",
    duration: sendMailCallDurationMs,
    name: eventName,
    properties: {
      addressSource: emailNotification.addressSource,
      transport: lMailerTransporter.transporter.name
    }
  };

  if (isLeft(sendResult)) {
    const error = sendResult.value;
    // track the event of failed delivery
    lAppInsightsClient.trackDependency({
      ...eventContent,
      data: error.message,
      resultCode: error.name,
      success: false
    });
    return left<RuntimeError, NotificationEvent>(
      TransientError(
        `Error while sending email|notification=${notificationId}|message=${
          message.id
        }|error=${error.message}`
      )
    );
  }

  // track the event of successful delivery
  lAppInsightsClient.trackDependency({
    ...eventContent,
    data: "OK",
    resultCode: 200,
    success: true
  });

  // TODO: handling bounces and delivery updates
  // see https://nodemailer.com/usage/#sending-mail
  // see #150597597
  return right<RuntimeError, NotificationEvent>(emailNotificationEvent);
}

/**
 * Function handler
 */
export async function index(
  context: ContextWithBindings
): Promise<OutputBindings | Error | void> {
  const stopProcessing = undefined;
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(`STARTED|${context.invocationId}`);

  winston.debug(
    `EmailNotificationsHandlerIndex|Dequeued email notification|${JSON.stringify(
      context.bindings
    )}`
  );

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  const errorOrNotificationEvent = NotificationEvent.decode(
    context.bindings.notificationEvent
  );
  if (isLeft(errorOrNotificationEvent)) {
    winston.error(
      `EmailNotificationsHandler|Fatal! No valid message found in bindings.|${readableReport(
        errorOrNotificationEvent.value
      )}`
    );
    return stopProcessing;
  }
  const emailNotificationEvent = errorOrNotificationEvent.value;

  const notificationStatusUpdater = getNotificationStatusUpdater(
    notificationStatusModel,
    NotificationChannelEnum.EMAIL,
    emailNotificationEvent.message.id,
    emailNotificationEvent.notificationId
  );

  winston.debug(`useSendgridTransport:${useSendgridTransport}`);

  const mailerTransporter = NodeMailer.createTransport(
    useSendgridTransport
      ? SendgridTransport({
          auth: {
            api_key: sendgridApiKey
          }
        })
      : MailUpTransport({
          creds: {
            Secret: mailupSecret,
            Username: mailupUsername
          }
        })
  );

  const serviceId = emailNotificationEvent.message.senderServiceId;

  const eventName = "handler.notification.email";

  const appInsightsClient = getCustomTelemetryClient(
    {
      operationId: emailNotificationEvent.notificationId,
      operationParentId: emailNotificationEvent.message.id,
      serviceId: NonEmptyString.is(serviceId) ? serviceId : undefined
    },
    {
      messageId: emailNotificationEvent.message.id,
      notificationId: emailNotificationEvent.notificationId
    }
  );

  return handleNotification(
    mailerTransporter,
    appInsightsClient,
    notificationModel,
    emailNotificationEvent,
    {
      HTML_TO_TEXT_OPTIONS,
      MAIL_FROM
    }
  )
    .then(errorOrEmailNotificationEvt =>
      errorOrEmailNotificationEvt.fold(
        async error => {
          if (isExpiredError(error)) {
            // message is expired. try to save the notification status into the database
            const errorOrUpdateNotificationStatus = await notificationStatusUpdater(
              NotificationChannelStatusValueEnum.EXPIRED
            );
            if (isLeft(errorOrUpdateNotificationStatus)) {
              // retry the whole handler in case we cannot save
              // the notification status into the database
              throw TransientError(
                errorOrUpdateNotificationStatus.value.message
              );
            }
            // if the message is expired we're done, stop here
            return;
          }
          // for every other kind of error
          // delegate to the catch handler
          throw error;
        },
        async _ => {
          // success. try to save the notification status into the database
          const errorOrUpdatedNotificationStatus = await notificationStatusUpdater(
            NotificationChannelStatusValueEnum.SENT
          );
          if (isLeft(errorOrUpdatedNotificationStatus)) {
            // retry the whole handler in case we cannot save
            // the notification status into the database
            throw TransientError(
              errorOrUpdatedNotificationStatus.value.message
            );
          }

          winston.debug(
            `EmailNotificationsHandler|Email notification succeeded|notification=${
              emailNotificationEvent.notificationId
            }|message=${emailNotificationEvent.message.id}`
          );

          appInsightsClient.trackEvent({
            measurements: {
              elapsed:
                Date.now() - emailNotificationEvent.message.createdAt.getTime()
            },
            name: eventName,
            properties: {
              success: "true"
            }
          });
        }
      )
    )
    .catch(error =>
      handleQueueProcessingFailure(
        queueService,
        context.bindingData,
        EMAIL_NOTIFICATION_QUEUE_NAME,
        // execute in case of transient errors
        () => {
          appInsightsClient.trackEvent({
            measurements: {
              elapsed:
                Date.now() - emailNotificationEvent.message.createdAt.getTime()
            },
            name: eventName,
            properties: {
              error: JSON.stringify(error),
              success: "false",
              transient: "true"
            }
          });
          return notificationStatusUpdater(
            NotificationChannelStatusValueEnum.THROTTLED
          );
        },
        // execute in case of permanent errors
        () => {
          appInsightsClient.trackEvent({
            measurements: {
              elapsed:
                Date.now() - emailNotificationEvent.message.createdAt.getTime()
            },
            name: eventName,
            properties: {
              error: JSON.stringify(error),
              success: "false",
              transient: "false"
            }
          });
          return notificationStatusUpdater(
            NotificationChannelStatusValueEnum.FAILED
          );
        },
        error
      )
    );
}
