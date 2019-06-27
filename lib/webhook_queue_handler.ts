/*
 * This function will process events triggered by newly created messages.
 *
 * For each new input message, retrieve the URL associated to the webhook
 * from the payload then send an HTTP request to the API Proxy
 * which in turns delivers the message to the mobile App.
 */

import * as t from "io-ts";

import * as request from "superagent";

import * as winston from "winston";

import { configureAzureContextTransport } from "io-functions-commons/dist/src/utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { getRequiredStringEnv } from "./utils/env";

import { Context } from "@azure/functions";

import {
  NOTIFICATION_COLLECTION_NAME,
  NotificationModel,
  WebhookNotification
} from "io-functions-commons/dist/src/models/notification";
import { NotificationEvent } from "io-functions-commons/dist/src/models/notification_event";

import {
  ExpiredError,
  isExpiredError,
  PermanentError,
  RuntimeError,
  TransientError
} from "io-functions-commons/dist/src/utils/errors";

import { handleQueueProcessingFailure } from "./utils/azure_queues";

import { createQueueService } from "azure-storage";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "./api/definitions/NotificationChannelStatusValue";

import { TelemetryClient } from "applicationinsights";
import { CreatedMessageEventSenderMetadata } from "io-functions-commons/dist/src/models/created_message_sender_metadata";
import {
  ActiveMessage,
  NewMessageWithoutContent
} from "io-functions-commons/dist/src/models/message";
import {
  getNotificationStatusUpdater,
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel
} from "io-functions-commons/dist/src/models/notification_status";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { UrlFromString } from "italia-ts-commons/lib/url";
import { CreatedMessageWithContent } from "./api/definitions/CreatedMessageWithContent";
import { HttpsUrl } from "./api/definitions/HttpsUrl";
import { MessageContent } from "./api/definitions/MessageContent";
import { SenderMetadata } from "./api/definitions/SenderMetadata";
import {
  diffInMilliseconds,
  wrapCustomTelemetryClient
} from "./utils/application_insights";

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

export const WEBHOOK_NOTIFICATION_QUEUE_NAME = "webhooknotifications";
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

/**
 * Input and output bindings for this function
 * see WebhookNotificationsQueueHandler/function.json
 */
const ContextWithBindings = t.interface({
  bindings: t.partial({
    notificationEvent: NotificationEvent
  })
});

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & Context;

type OutputBindings = never;

// request timeout in milliseconds
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

/**
 * Convert the internal representation of the message
 * to the one of the public API
 */
function newMessageToPublic(
  newMessage: NewMessageWithoutContent,
  content: MessageContent
): CreatedMessageWithContent {
  return {
    content,
    created_at: newMessage.createdAt,
    fiscal_code: newMessage.fiscalCode,
    id: newMessage.id,
    sender_service_id: newMessage.senderServiceId
  };
}

/**
 * Convert the internal representation of sender metadata
 * to the one of the public API
 */
function senderMetadataToPublic(
  senderMetadata: CreatedMessageEventSenderMetadata
): SenderMetadata {
  return {
    department_name: senderMetadata.departmentName,
    organization_name: senderMetadata.organizationName,
    service_name: senderMetadata.serviceName
  };
}

/**
 * Post data to the API proxy webhook endpoint.
 */
export async function sendToWebhook(
  webhookEndpoint: HttpsUrl,
  message: NewMessageWithoutContent,
  content: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): Promise<Either<RuntimeError, request.Response>> {
  return request("POST", webhookEndpoint)
    .timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    .set("Content-Type", "application/json")
    .accept("application/json")
    .send({
      message: newMessageToPublic(message, content),
      sender_metadata: senderMetadataToPublic(senderMetadata)
    })
    .then(
      response => {
        if (response.error) {
          return left<RuntimeError, request.Response>(
            // in case of server HTTP 5xx errors we trigger a retry
            response.serverError
              ? TransientError(
                  `Transient HTTP error calling API Proxy: ${response.text}`
                )
              : PermanentError(
                  `Permanent HTTP error calling API Proxy: ${response.text}`
                )
          );
        }
        return right<RuntimeError, request.Response>(response);
      },
      err => {
        const errorMsg =
          err.response && err.response.text
            ? err.response.text
            : "unknown error";
        return left<RuntimeError, request.Response>(
          err.timeout
            ? TransientError(`Timeout calling API Proxy`)
            : // when the server returns an HTTP 5xx error
            err.status && err.status % 500 < 100
            ? TransientError(`Transient error calling API proxy: ${errorMsg}`)
            : // when the server returns some other type of HTTP error
              PermanentError(`Permanent error calling API Proxy: ${errorMsg}`)
        );
      }
    );
}

/**
 * Handles the notification logic.
 *
 * This function will fetch the notification data and its associated message.
 * It will then send the message to the webhook.
 */
export async function handleNotification(
  lAppInsightsClient: TelemetryClient,
  lNotificationModel: NotificationModel,
  webhookNotificationEvent: NotificationEvent
): Promise<Either<RuntimeError, NotificationEvent>> {
  const {
    content,
    message,
    notificationId,
    senderMetadata
  } = webhookNotificationEvent;

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

  const maybeWebhookNotification = errorOrMaybeNotification.value;

  if (isNone(maybeWebhookNotification)) {
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

  const errorOrWebhookNotification = WebhookNotification.decode(
    maybeWebhookNotification.value
  );

  if (isLeft(errorOrWebhookNotification)) {
    const error = readableReport(errorOrWebhookNotification.value);
    return left<RuntimeError, NotificationEvent>(
      PermanentError(
        `Wrong format for webhook notification|notification=${notificationId}|message=${
          message.id
        }|${error}`
      )
    );
  }

  const webhookNotification = errorOrWebhookNotification.value.channels.WEBHOOK;

  const startWebhookCallTime = process.hrtime();

  const sendResult = await sendToWebhook(
    webhookNotification.url,
    message,
    content,
    senderMetadata
  );

  const webhookCallDurationMs = diffInMilliseconds(startWebhookCallTime);

  const eventName = "notification.webhook.delivery";

  // hide backend secret token in logs
  const hostName = UrlFromString.decode(webhookNotification.url).fold(
    _ => "invalid url",
    url => url.hostname || "invalid hostname"
  );

  const eventContent = {
    data: hostName,
    dependencyTypeName: "HTTP",
    duration: webhookCallDurationMs,
    name: eventName
  };

  if (isLeft(sendResult)) {
    const error = sendResult.value;
    // track the event of failed delivery
    lAppInsightsClient.trackDependency({
      ...eventContent,
      properties: {
        error: error.message
      },
      resultCode: error.kind,
      success: false
    });
    return left<RuntimeError, NotificationEvent>(error);
  }

  const apiMessageResponse = sendResult.value;

  // track the event of successful delivery
  lAppInsightsClient.trackDependency({
    ...eventContent,
    resultCode: apiMessageResponse.status,
    success: true
  });

  return right<RuntimeError, NotificationEvent>(webhookNotificationEvent);
}

/**
 * Function handler
 */
export async function index(
  context: ContextWithBindings
): Promise<OutputBindings | Error | void> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(
    `WebhookNotificationsHandlerIndex|Dequeued webhook notification|${JSON.stringify(
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
      `WebhookNotificationsHandler|Fatal! No valid message found in bindings.|${readableReport(
        errorOrNotificationEvent.value
      )}`
    );
    return;
  }
  const webhookNotificationEvent = errorOrNotificationEvent.value;

  const notificationStatusUpdater = getNotificationStatusUpdater(
    notificationStatusModel,
    NotificationChannelEnum.WEBHOOK,
    webhookNotificationEvent.message.id,
    webhookNotificationEvent.notificationId
  );

  const serviceId = webhookNotificationEvent.message.senderServiceId;

  const eventName = "handler.notification.webhook";

  const appInsightsClient = getCustomTelemetryClient(
    {
      operationId: webhookNotificationEvent.notificationId,
      operationParentId: webhookNotificationEvent.message.id,
      serviceId: NonEmptyString.is(serviceId) ? serviceId : undefined
    },
    {
      messageId: webhookNotificationEvent.message.id,
      notificationId: webhookNotificationEvent.notificationId
    }
  );

  return handleNotification(
    appInsightsClient,
    notificationModel,
    webhookNotificationEvent
  )
    .then(errorOrWebhookNotificationEvt =>
      errorOrWebhookNotificationEvt.fold(
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
            `WebhookNotificationsHandler|Webhook notification succeeded|notification=${
              webhookNotificationEvent.notificationId
            }|message=${webhookNotificationEvent.message.id}`
          );

          appInsightsClient.trackEvent({
            measurements: {
              elapsed:
                Date.now() -
                webhookNotificationEvent.message.createdAt.getTime()
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
        WEBHOOK_NOTIFICATION_QUEUE_NAME,
        // execute in case of transient errors
        () => {
          appInsightsClient.trackEvent({
            measurements: {
              elapsed:
                Date.now() -
                webhookNotificationEvent.message.createdAt.getTime()
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
                Date.now() -
                webhookNotificationEvent.message.createdAt.getTime()
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
