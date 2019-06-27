/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as t from "io-ts";

import * as winston from "winston";

import { Context } from "@azure/functions";

import { DocumentClient as DocumentDBClient } from "documentdb";

import { configureAzureContextTransport } from "io-functions-commons/dist/src/utils/logging";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import { Set } from "json-set-map";

import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";

import {
  BlobService,
  createBlobService,
  createQueueService
} from "azure-storage";

import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { CreatedMessageEvent } from "io-functions-commons/dist/src/models/created_message_event";
import {
  MESSAGE_COLLECTION_NAME,
  MessageModel,
  NewMessageWithoutContent
} from "io-functions-commons/dist/src/models/message";
import {
  createNewNotification,
  NewNotification,
  NOTIFICATION_COLLECTION_NAME,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel
} from "io-functions-commons/dist/src/models/notification";
import { NotificationEvent } from "io-functions-commons/dist/src/models/notification_event";
import {
  IProfileBlockedInboxOrChannels,
  PROFILE_COLLECTION_NAME,
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";

import {
  isRecipientError,
  RecipientError,
  RuntimeError,
  TransientError
} from "io-functions-commons/dist/src/utils/errors";
import { handleQueueProcessingFailure } from "./utils/azure_queues";

import { MessageStatusValueEnum } from "./api/definitions/MessageStatusValue";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { withoutUndefinedValues } from "italia-ts-commons/lib/types";

import { TelemetryClient } from "applicationinsights";
import { BlockedInboxOrChannelEnum } from "./api/definitions/BlockedInboxOrChannel";
import { HttpsUrl } from "./api/definitions/HttpsUrl";
import { MessageContent } from "./api/definitions/MessageContent";

import { CreatedMessageEventSenderMetadata } from "io-functions-commons/dist/src/models/created_message_sender_metadata";
import {
  getMessageStatusUpdater,
  MESSAGE_STATUS_COLLECTION_NAME,
  MessageStatusModel
} from "io-functions-commons/dist/src/models/message_status";
import {
  newSenderService,
  SENDER_SERVICE_COLLECTION_NAME,
  SenderServiceModel
} from "io-functions-commons/dist/src/models/sender_service";

import { wrapCustomTelemetryClient } from "io-functions-commons/dist/src/utils/application_insights";

import { ulidGenerator } from "io-functions-commons/dist/src/utils/strings";

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
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  PROFILE_COLLECTION_NAME
);
const messagesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_COLLECTION_NAME
);
const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_COLLECTION_NAME
);
const messageStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_STATUS_COLLECTION_NAME
);
const senderServicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  SENDER_SERVICE_COLLECTION_NAME
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

const senderServiceModel = new SenderServiceModel(
  documentClient,
  senderServicesCollectionUrl
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

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & Context;

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
  newMessageWithoutContent: NewMessageWithoutContent,
  newMessageContent: MessageContent,
  newNotification: NewNotification
): Promise<Either<RuntimeError, NotificationEvent>> {
  const errorOrNotification = await lNotificationModel.create(
    newNotification,
    newNotification.messageId
  );

  if (isLeft(errorOrNotification)) {
    return left<RuntimeError, NotificationEvent>(
      TransientError("Cannot save notification to database")
    );
  }

  const notification = errorOrNotification.value;

  const notificationEvent: NotificationEvent = {
    content: newMessageContent,
    message: newMessageWithoutContent,
    notificationId: notification.id,
    senderMetadata
  };
  return right<RuntimeError, NotificationEvent>(notificationEvent);
}

/**
 * Handles the retrieved message by looking up the associated profile and
 * creating a Notification record that has all the channels configured.
 *
 * @returns an array of Notifications in case of success
 *          a TransientError in case of recoverable errors
 *          a PermanentError in case of unrecoverable error
 */
// tslint:disable-next-line:no-big-function
export async function handleMessage(
  lProfileModel: ProfileModel,
  lMessageModel: MessageModel,
  lNotificationModel: NotificationModel,
  lSenderServiceModel: SenderServiceModel,
  lBlobService: BlobService,
  lDefaultWebhookUrl: HttpsUrl,
  createdMessageEvent: CreatedMessageEvent
): Promise<Either<RuntimeError, OutputBindings>> {
  const newMessageWithoutContent = createdMessageEvent.message;
  const defaultAddresses = fromNullable(createdMessageEvent.defaultAddresses);
  const senderMetadata = createdMessageEvent.senderMetadata;

  // fetch user's profile associated to the fiscal code
  // of the recipient of the message
  const errorOrMaybeProfile = await lProfileModel.findOneProfileByFiscalCode(
    newMessageWithoutContent.fiscalCode
  );

  if (isLeft(errorOrMaybeProfile)) {
    // The query has failed.
    // It's *critical* to trigger a retry here
    // otherwise no message content will be saved
    return left<RuntimeError, OutputBindings>(
      TransientError("Cannot get user's profile")
    );
  }

  const maybeProfile = errorOrMaybeProfile.value;

  if (isNone(maybeProfile)) {
    // the recipient doesn't have any profile yet
    return left<RuntimeError, OutputBindings>(
      RecipientError("Recipient profile does not exist.")
    );
  }

  const profile = maybeProfile.value;

  // channels ther user has blocked for this sender service
  const blockedInboxOrChannels = fromNullable(profile.blockedInboxOrChannels)
    .chain((bc: IProfileBlockedInboxOrChannels) =>
      fromNullable(bc[newMessageWithoutContent.senderServiceId])
    )
    .getOrElse(new Set());

  winston.debug(
    "handleMessage|Blocked Channels(%s): %s",
    newMessageWithoutContent.fiscalCode,
    JSON.stringify(blockedInboxOrChannels)
  );

  //
  //  Inbox storage
  //

  // a profile exists and the global inbox flag is enabled
  const isInboxEnabled = profile.isInboxEnabled === true;

  if (!isInboxEnabled) {
    // the recipient's inbox is disabled
    return left<RuntimeError, OutputBindings>(
      RecipientError("Recipient inbox is disabled.")
    );
  }

  // whether the user has blocked inbox storage for messages from this sender
  const isMessageStorageBlockedForService = blockedInboxOrChannels.has(
    BlockedInboxOrChannelEnum.INBOX
  );

  if (isMessageStorageBlockedForService) {
    // the recipient's inbox is disabled
    return left<RuntimeError, OutputBindings>(
      RecipientError("Sender is blocked by recipient.")
    );
  }

  // Save the content of the message to the blob storage.
  // In case of a retry this operation will overwrite the message content with itself
  // (this is fine as we don't know if the operation succeeded at first)
  const errorOrAttachment = await lMessageModel.attachStoredContent(
    lBlobService,
    newMessageWithoutContent.id,
    newMessageWithoutContent.fiscalCode,
    createdMessageEvent.content
  );
  if (isLeft(errorOrAttachment)) {
    return left<RuntimeError, OutputBindings>(
      TransientError("Cannot store message content")
    );
  }

  // Now that the message content has been stored, we can make the message
  // visible to getMessages by changing the pending flag to false
  const updatedMessageOrError = await lMessageModel.createOrUpdate(
    {
      ...newMessageWithoutContent,
      isPending: false
    },
    createdMessageEvent.message.fiscalCode
  );
  if (isLeft(updatedMessageOrError)) {
    return left<RuntimeError, OutputBindings>(
      TransientError("Cannot update message pending status")
    );
  }

  //
  //  Email notification
  //

  // check if the user has blocked emails sent from this service
  // 'some(true)' in case we must send the notification by email
  // 'none' in case the user has blocked the email channel
  const isEmailBlockedForService = blockedInboxOrChannels.has(
    BlockedInboxOrChannelEnum.EMAIL
  );

  const maybeAllowedEmailNotification = isEmailBlockedForService
    ? none
    : getEmailAddressFromProfile(profile)
        // if it's not set, or we don't have a profile for this fiscal code,
        // try to get the default email address from the request payload
        .alt(defaultAddresses.chain(getEmailAddressFromDefaultAddresses))
        .orElse(() => {
          winston.debug(
            `handleMessage|User profile has no email address set and no default address was provided|${
              newMessageWithoutContent.fiscalCode
            }`
          );
          return none;
        });

  //
  //  Webhook notification
  //

  // check if the user has blocked webhook notifications sent from this service
  const isWebhookBlockedForService = blockedInboxOrChannels.has(
    BlockedInboxOrChannelEnum.WEBHOOK
  );

  // whether the recipient wants us to send notifications to the app backend
  const isWebhookBlockedInProfile = profile.isWebhookEnabled === true;

  const isWebhookEnabled =
    !isWebhookBlockedForService && isWebhookBlockedInProfile;

  const maybeAllowedWebhookNotification = isWebhookEnabled
    ? some({
        url: lDefaultWebhookUrl
      })
    : none;

  // store fiscalCode -> serviceId
  const errorOrSenderService = await lSenderServiceModel.createOrUpdate(
    newSenderService(
      newMessageWithoutContent.fiscalCode,
      newMessageWithoutContent.senderServiceId,
      createdMessageEvent.serviceVersion
    ),
    // partition key
    newMessageWithoutContent.fiscalCode
  );

  if (isLeft(errorOrSenderService)) {
    return left<RuntimeError, OutputBindings>(
      TransientError(
        `Cannot save sender service id: ${errorOrSenderService.value.body}`
      )
    );
  }

  const noChannelsConfigured = [
    maybeAllowedEmailNotification,
    maybeAllowedWebhookNotification
  ].every(_ => _.isNone());

  if (noChannelsConfigured) {
    winston.debug(
      `handleMessage|No channels configured for the user ${
        newMessageWithoutContent.fiscalCode
      } and no default address provided`
    );
    // return no notifications
    return right<RuntimeError, OutputBindings>({});
  }

  // create and save notification object
  const newNotification: NewNotification = {
    ...createNewNotification(
      ulidGenerator,
      newMessageWithoutContent.fiscalCode,
      newMessageWithoutContent.id
    ),
    channels: withoutUndefinedValues({
      [NotificationChannelEnum.EMAIL]: maybeAllowedEmailNotification.toUndefined(),
      [NotificationChannelEnum.WEBHOOK]: maybeAllowedWebhookNotification.toUndefined()
    })
  };

  const errorOrNotificationEvent = await createNotification(
    lNotificationModel,
    senderMetadata,
    newMessageWithoutContent,
    createdMessageEvent.content,
    newNotification
  );

  if (isLeft(errorOrNotificationEvent)) {
    return left<RuntimeError, OutputBindings>(errorOrNotificationEvent.value);
  }

  const notificationEvent = errorOrNotificationEvent.value;

  // output notification events (one for each channel)
  const outputBindings: OutputBindings = {
    emailNotification: maybeAllowedEmailNotification
      .map(() => notificationEvent)
      .toUndefined(),
    webhookNotification: maybeAllowedWebhookNotification
      .map(() => notificationEvent)
      .toUndefined()
  };

  // avoid to enqueue messages for non existing notifications
  return right<RuntimeError, OutputBindings>(
    withoutUndefinedValues(outputBindings)
  );
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

  winston.debug(
    `CreatedMessageQueueHandler|A new message was created|${
      newMessageWithContent.id
    }|${newMessageWithContent.fiscalCode}`
  );

  const messageStatusUpdater = getMessageStatusUpdater(
    messageStatusModel,
    newMessageWithContent.id
  );

  const eventName = "handler.message.process";

  const appInsightsClient = getCustomTelemetryClient(
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
    senderServiceModel,
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
              channels: Object.keys(outputBindings).length.toString(),
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
        runtimeError => {
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
          return messageStatusUpdater(
            isRecipientError(runtimeError)
              ? MessageStatusValueEnum.REJECTED
              : MessageStatusValueEnum.FAILED
          );
        },
        error
      )
    );
}
