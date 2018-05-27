/*
* This function will process events triggered by newly created messages.
* For each new input message, the delivery preferences associated to the
* recipient of the message gets retrieved and a notification gets delivered
* to each configured channel.
*/

import * as t from "io-ts";

import * as winston from "winston";

import { IContext } from "azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import { configureAzureContextTransport } from "./utils/logging";

import * as documentDbUtils from "./utils/documentdb";

import { Set } from "json-set-map";

import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";

import {
  BlobService,
  createBlobService,
  createQueueService
} from "azure-storage";

import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";

import { getRequiredStringEnv } from "./utils/env";

import { CreatedMessageEvent } from "./models/created_message_event";
import { MessageModel, NewMessageWithContent } from "./models/message";
import {
  createNewNotification,
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel
} from "./models/notification";
import { NotificationEvent } from "./models/notification_event";
import {
  IProfileBlockedInboxOrChannels,
  ProfileModel,
  RetrievedProfile
} from "./models/profile";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { handleQueueProcessingFailure } from "./utils/azure_queues";
import { PermanentError, RuntimeError, TransientError } from "./utils/errors";

import { MessageStatusValueEnum } from "./api/definitions/MessageStatusValue";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { withoutUndefinedValues } from "italia-ts-commons/lib/types";
import { BlockedInboxOrChannelEnum } from "./api/definitions/BlockedInboxOrChannel";
import { HttpsUrl } from "./api/definitions/HttpsUrl";
import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import {
  getMessageStatusUpdater,
  MESSAGE_STATUS_COLLECTION_NAME,
  MessageStatusModel
} from "./models/message_status";
import { getApplicationInsightsTelemetryClient } from "./utils/application_insights";
import { ulidGenerator } from "./utils/strings";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup DocumentDB
const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "profiles"
);
const messagesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "messages"
);
const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "notifications"
);
const messageStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_STATUS_COLLECTION_NAME
);

const defaultWebhookUrl = HttpsUrl.decode(
  getRequiredStringEnv("WEBHOOK_CHANNEL_URL")
).getOrElseL(_ => {
  throw new Error(
    `Check that the environment variable WEBHOOK_CHANNEL_URL is set to a valid URL`
  );
});

// must be equal to the queue name in function.json
export const MESSAGE_QUEUE_NAME = "createdmessages";

const messageContainerName = getRequiredStringEnv("MESSAGE_CONTAINER_NAME");
const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

// We create the db client, services and models here
// as if any error occurs during the construction of these objects
// that would be unrecoverable anyway and we neither may trig a retry
const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const messageStatusModel = new MessageStatusModel(
  documentClient,
  messageStatusCollectionUrl
);

// As we cannot use Functions bindings to do retries,
// we resort to update the message visibility timeout
// using the queue service (client for Azure queue storage)
const queueService = createQueueService(queueConnectionString);

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);

const messageModel = new MessageModel(
  documentClient,
  messagesCollectionUrl,
  messageContainerName
);

const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

const blobService = createBlobService(storageConnectionString);

const InputBindings = t.partial({
  createdMessage: CreatedMessageEvent
});
type InputBindings = t.TypeOf<typeof InputBindings>;

const OutputBindings = t.partial({
  emailNotification: NotificationEvent,
  webhookNotification: NotificationEvent
});
type OutputBindings = t.TypeOf<typeof OutputBindings>;

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
const ContextWithBindings = t.interface({
  bindings: t.intersection([InputBindings, OutputBindings])
});

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & IContext;

/**
 * Attempt to resolve an email address from
 * the provided default address.
 */
function getEmailAddressFromDefaultAddresses(
  defaultAddresses: NewMessageDefaultAddresses
): Option<NotificationChannelEmail> {
  return fromNullable(defaultAddresses.email).map(email => ({
    addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
    toAddress: email
  }));
}

/**
 * Attempt to resolve an email address from
 * the recipient profile.
 */
function getEmailAddressFromProfile(
  profile: RetrievedProfile
): Option<NotificationChannelEmail> {
  return fromNullable(profile.email).map(email => ({
    addressSource: NotificationAddressSourceEnum.PROFILE_ADDRESS,
    toAddress: email
  }));
}

/**
 * Try to create (save) a new notification
 */
async function createNotification(
  lNotificationModel: NotificationModel,
  senderMetadata: CreatedMessageEventSenderMetadata,
  newMessageWithContent: NewMessageWithContent,
  newNotification: NewNotification
): Promise<Either<RuntimeError, NotificationEvent>> {
  const errorOrNotification = await lNotificationModel.create(
    newNotification,
    newNotification.messageId
  );

  if (isLeft(errorOrNotification)) {
    return left(TransientError("Cannot save notification to database"));
  }

  const notification = errorOrNotification.value;

  const notificationEvent: NotificationEvent = {
    message: {
      ...newMessageWithContent,
      kind: "INewMessageWithContent"
    },
    notificationId: notification.id,
    senderMetadata
  };
  return right(notificationEvent);
}

/**
 * Handles the retrieved message by looking up the associated profile and
 * creating a Notification record that has all the channels configured.
 *
 * @returns an array of Notifications in case of success
 *          a TransientError in case of recoverable errors
 *          a PermanentError in case of unrecoverable error
 */
export async function handleMessage(
  lProfileModel: ProfileModel,
  lMessageModel: MessageModel,
  lNotificationModel: NotificationModel,
  lBlobService: BlobService,
  lDefaultWebhookUrl: HttpsUrl,
  createdMessageEvent: CreatedMessageEvent
): Promise<Either<RuntimeError, OutputBindings>> {
  const newMessageWithContent = createdMessageEvent.message;
  const defaultAddresses = fromNullable(createdMessageEvent.defaultAddresses);
  const senderMetadata = createdMessageEvent.senderMetadata;

  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await lProfileModel.findOneProfileByFiscalCode(
    newMessageWithContent.fiscalCode
  );

  if (isLeft(errorOrMaybeProfile)) {
    // The query has failed.
    // It's *critical* to trigger a retry here
    // otherwise no message content will be saved
    return left(TransientError("Cannot get user's profile"));
  }

  // query succeeded, we may have a profile
  const maybeProfile = errorOrMaybeProfile.value;

  // channels ther user has blocked for this sender service
  const blockedInboxOrChannels = maybeProfile
    .chain(profile =>
      fromNullable(profile.blockedInboxOrChannels).map(
        (bc: IProfileBlockedInboxOrChannels) =>
          bc[newMessageWithContent.senderServiceId]
      )
    )
    .getOrElse(new Set());

  winston.debug(
    "handleMessage|Blocked Channels(%s): %s",
    newMessageWithContent.fiscalCode,
    JSON.stringify(blockedInboxOrChannels)
  );

  //
  //  Inbox storage
  //

  // check if the user has blocked inbox message storage from this service
  const isMessageStorageBlockedForService = blockedInboxOrChannels.has(
    BlockedInboxOrChannelEnum.INBOX
  );

  // whether the recipient wants us to store the message content
  const isMessageStorageEnabledAndAllowedForService =
    !isMessageStorageBlockedForService &&
    maybeProfile.exists(profile => profile.isInboxEnabled === true);

  if (isMessageStorageEnabledAndAllowedForService) {
    // If the recipient wants to store the messages
    // we add the content of the message to the blob storage for later retrieval.
    // In case of a retry this operation will overwrite the message content with itself
    // (this is fine as we don't know if the operation succeeded at first)
    const errorOrAttachment = await lMessageModel.attachStoredContent(
      lBlobService,
      newMessageWithContent.id,
      newMessageWithContent.fiscalCode,
      newMessageWithContent.content
    );
    if (isLeft(errorOrAttachment)) {
      return left(TransientError("Cannot store message content"));
    }
  }

  //
  //  Email notification
  //

  // check if the user has blocked emails sent from this service
  // 'some(true)' in case we must send the notification by email
  // 'none' in case the user has blocked the email channel
  const isEmailBlockedForService =
    isMessageStorageBlockedForService ||
    blockedInboxOrChannels.has(BlockedInboxOrChannelEnum.EMAIL);

  if (isEmailBlockedForService) {
    winston.debug(
      `handleMessage|User has blocked email notifications for this serviceId|${
        newMessageWithContent.fiscalCode
      }:${newMessageWithContent.senderServiceId}`
    );
  }

  const maybeAllowedEmailNotification = isEmailBlockedForService
    ? none
    : maybeProfile
        // try to get the destination email address from the user's profile
        .chain(getEmailAddressFromProfile)
        // if it's not set, or we don't have a profile for this fiscal code,
        // try to get the default email address from the request payload
        .alt(defaultAddresses.chain(getEmailAddressFromDefaultAddresses))
        .orElse(() => {
          winston.debug(
            `handleMessage|User profile has no email address set and no default address was provided|${
              newMessageWithContent.fiscalCode
            }`
          );
          return none;
        });

  //
  //  Webhook notification
  //

  // check if the user has blocked webhook notifications sent from this service
  const isWebhookBlockedForService =
    isMessageStorageBlockedForService ||
    blockedInboxOrChannels.has(BlockedInboxOrChannelEnum.WEBHOOK);

  if (isWebhookBlockedForService) {
    winston.debug(
      `handleMessage|User has blocked webhook notifications for this serviceId|${
        newMessageWithContent.fiscalCode
      }:${newMessageWithContent.senderServiceId}`
    );
  }

  // whether the recipient wants us to send notifications to the app backend
  const isWebhookBlockedInProfile = maybeProfile.exists(
    profile => profile.isWebhookEnabled === true
  );

  const isWebhookEnabled =
    !isWebhookBlockedForService && isWebhookBlockedInProfile;

  const maybeAllowedWebhookNotification = isWebhookEnabled
    ? some({
        url: lDefaultWebhookUrl
      })
    : none;

  const noChannelsConfigured = [
    maybeAllowedEmailNotification,
    maybeAllowedWebhookNotification
  ].every(isNone);

  if (noChannelsConfigured) {
    return left(
      PermanentError(
        `No channels configured for the user ${
          newMessageWithContent.fiscalCode
        } and no default address provided`
      )
    );
  }

  const newNotification: NewNotification = {
    ...createNewNotification(
      ulidGenerator,
      newMessageWithContent.fiscalCode,
      newMessageWithContent.id
    ),
    channels: withoutUndefinedValues({
      [NotificationChannelEnum.EMAIL]: maybeAllowedEmailNotification.toUndefined(),
      [NotificationChannelEnum.WEBHOOK]: maybeAllowedWebhookNotification.toUndefined()
    })
  };

  const errorOrNotificationEvent = await createNotification(
    lNotificationModel,
    senderMetadata,
    newMessageWithContent,
    newNotification
  );

  if (isLeft(errorOrNotificationEvent)) {
    return left(errorOrNotificationEvent.value);
  }

  const notificationEvent = errorOrNotificationEvent.value;

  //
  //  Return notification events (one for each channel)
  //
  const outputBindings: OutputBindings = {
    emailNotification: maybeAllowedEmailNotification
      .map(() => notificationEvent)
      .toUndefined(),
    webhookNotification: maybeAllowedWebhookNotification
      .map(() => notificationEvent)
      .toUndefined()
  };

  // avoid to enqueue messages for non existing notifications
  return right(withoutUndefinedValues(outputBindings));
}

/**
 * Handler that gets triggered on incoming event.
 */
export async function index(
  context: ContextWithBindings
): Promise<OutputBindings | Error | void> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(
    `CreatedMessageQueueHandler|queueMessage|${JSON.stringify(
      context.bindings
    )}`
  );

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  const errorOrCreatedMessageEvent = CreatedMessageEvent.decode(
    context.bindings.createdMessage
  );
  if (isLeft(errorOrCreatedMessageEvent)) {
    winston.error(
      `CreatedMessageQueueHandler|Fatal! No valid message found in bindings.|${readableReport(
        errorOrCreatedMessageEvent.value
      )}`
    );
    // we will never be able to recover from this, so don't trigger a retry
    return;
  }

  const createdMessageEvent = errorOrCreatedMessageEvent.value;
  const newMessageWithContent = createdMessageEvent.message;

  winston.info(
    `CreatedMessageQueueHandler|A new message was created|${
      newMessageWithContent.id
    }|${newMessageWithContent.fiscalCode}`
  );

  const messageStatusUpdater = getMessageStatusUpdater(
    messageStatusModel,
    newMessageWithContent.id
  );

  const eventName = "handler.message.process";

  const appInsightsClient = getApplicationInsightsTelemetryClient(
    {
      operationId: newMessageWithContent.id,
      operationParentId: newMessageWithContent.id,
      serviceId: NonEmptyString.is(newMessageWithContent.senderServiceId)
        ? newMessageWithContent.senderServiceId
        : undefined
    },
    {
      messageId: newMessageWithContent.id
    }
  );

  // now we can trigger the notifications for the message
  return handleMessage(
    profileModel,
    messageModel,
    notificationModel,
    blobService,
    defaultWebhookUrl,
    createdMessageEvent
  )
    .then(errorOrOutputBindings =>
      errorOrOutputBindings.fold(
        error => {
          // delegate to the catch handler
          throw error;
        },
        async outputBindings => {
          await messageStatusUpdater(MessageStatusValueEnum.PROCESSED);
          winston.debug(
            `CreatedMessageQueueHandler|succeeded|message=${
              newMessageWithContent.id
            }`
          );

          appInsightsClient.trackEvent({
            measurements: {
              elapsed: Date.now() - newMessageWithContent.createdAt.getTime()
            },
            name: eventName,
            properties: {
              success: "true"
            }
          });

          return outputBindings;
        }
      )
    )
    .catch(error =>
      handleQueueProcessingFailure(
        queueService,
        context.bindingData,
        MESSAGE_QUEUE_NAME,
        // execute in case of transient errors
        () => {
          appInsightsClient.trackEvent({
            measurements: {
              elapsed: Date.now() - newMessageWithContent.createdAt.getTime()
            },
            name: eventName,
            properties: {
              error: JSON.stringify(error),
              success: "false",
              transient: "true"
            }
          });
          return messageStatusUpdater(MessageStatusValueEnum.THROTTLED);
        },
        // execute in case of permanent errors
        () => {
          appInsightsClient.trackEvent({
            measurements: {
              elapsed: Date.now() - newMessageWithContent.createdAt.getTime()
            },
            name: eventName,
            properties: {
              error: JSON.stringify(error),
              success: "false",
              transient: "false"
            }
          });
          return messageStatusUpdater(MessageStatusValueEnum.FAILED);
        },
        error
      )
    );
}
