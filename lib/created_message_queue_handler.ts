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

import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";

import {
  BlobService,
  createBlobService,
  createQueueService,
  QueueService
} from "azure-storage";

import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";

import { getRequiredStringEnv } from "./utils/env";

import { CreatedMessageEvent } from "./models/created_message_event";
import { MessageModel, NewMessageWithContent } from "./models/message";
import {
  createNewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel,
  RetrievedNotification
} from "./models/notification";
import { NotificationEvent } from "./models/notification_event";
import { ProfileModel, RetrievedProfile } from "./models/profile";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Tuple2 } from "./utils/tuples";
import { readableReport } from "./utils/validation_reporters";

import {
  IQueueMessage,
  updateMessageVisibilityTimeout
} from "./utils/azure_queues";
import {
  isTransient,
  PermanentError,
  RuntimeError,
  TransientError
} from "./utils/errors";

import { EmailAddress } from "./api/definitions/EmailAddress";
import { MessageStatusValueEnum } from "./api/definitions/MessageStatusValue";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "./api/definitions/NotificationChannelStatusValue";
import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import {
  getMessageStatusUpdater,
  MESSAGE_STATUS_COLLECTION_NAME,
  MessageStatusModel,
  MessageStatusUpdater
} from "./models/message_status";
import {
  getNotificationStatusUpdater,
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel
} from "./models/notification_status";
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
const notificationStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_STATUS_COLLECTION_NAME
);
const messageStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_STATUS_COLLECTION_NAME
);

// must be equal to the queue name in function.json
export const MESSAGE_QUEUE_NAME = "createdmessages";

const messageContainerName = getRequiredStringEnv("MESSAGE_CONTAINER_NAME");
const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

const InputBindings = t.partial({
  createdMessage: CreatedMessageEvent
});
type InputBindings = t.TypeOf<typeof InputBindings>;

const OutputBindings = t.partial({
  emailNotification: NotificationEvent
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
 * Attempt to resolve an email address from the recipient profile
 * or from a provided default address.
 *
 * @param maybeProfile      the recipient's profile (or none)
 * @param defaultAddresses  default addresses (one per channel)
 */
function tryGetDestinationEmail(
  maybeProfile: Option<RetrievedProfile>,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Option<Tuple2<EmailAddress, NotificationAddressSourceEnum>> {
  const maybeProfileEmail = maybeProfile
    .chain(profile => fromNullable(profile.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.PROFILE_ADDRESS));
  const maybeDefaultEmail = defaultAddresses
    .chain(addresses => fromNullable(addresses.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.DEFAULT_ADDRESS));
  return maybeProfileEmail.alt(maybeDefaultEmail);
}

/**
 * Attempt to resolve an email notification.
 *
 * @param maybeProfile the user's profile we try to get an email address from
 * @param defaultAddresses the email address provided as input to the message APIs
 * @returns none when both maybeProfile.email and defaultAddresses are empty
 */
function tryGetEmailNotification(
  maybeProfile: Option<RetrievedProfile>,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Option<NotificationChannelEmail> {
  const maybeDestinationEmail = tryGetDestinationEmail(
    maybeProfile,
    defaultAddresses
  );
  // Now that we have a valid destination email address, we create an EmailNotification
  return maybeDestinationEmail.map(({ e1: toAddress, e2: addressSource }) => {
    return {
      addressSource,
      toAddress
    };
  });
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
  profileModel: ProfileModel,
  messageModel: MessageModel,
  notificationModel: NotificationModel,
  blobService: BlobService,
  newMessageWithContent: NewMessageWithContent,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Promise<Either<RuntimeError, RetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
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

  // whether the recipient wants us to store the message content
  const isMessageStorageEnabled = maybeProfile.exists(
    profile => profile.isInboxEnabled === true
  );

  if (isMessageStorageEnabled) {
    // If the recipient wants to store the messages
    // we add the content of the message to the blob storage for later retrieval.
    // In case of a retry this operation will overwrite the message content with itself
    // (this is fine as we don't know if the operation succeeded at first)
    const errorOrAttachment = await messageModel.attachStoredContent(
      blobService,
      newMessageWithContent.id,
      newMessageWithContent.fiscalCode,
      newMessageWithContent.content
    );
    if (isLeft(errorOrAttachment)) {
      return left(TransientError("Cannot store message content"));
    }
  }

  // Try to get email notification metadata from user's profile
  const maybeNotificationChannelEmail = tryGetEmailNotification(
    maybeProfile,
    defaultAddresses
  );

  if (isNone(maybeNotificationChannelEmail)) {
    // TODO: when we'll add other channels do not exit here (just log the error)
    return left(
      PermanentError(
        `Fiscal code has no associated email address and no default email address was provided|${
          newMessageWithContent.fiscalCode
        }`
      )
    );
  }

  const newNotification = createNewNotification(
    ulidGenerator,
    newMessageWithContent.fiscalCode,
    newMessageWithContent.id
  );

  const errorOrNotification = await notificationModel.create(
    {
      ...newNotification,
      channels: {
        [NotificationChannelEnum.EMAIL]: maybeNotificationChannelEmail.toUndefined()
      }
    },
    newNotification.messageId
  );

  if (isLeft(errorOrNotification)) {
    return left(TransientError("Cannot save notification to database"));
  }

  return right(errorOrNotification.value);
}

export async function processGenericError(
  messageStatusUpdater: MessageStatusUpdater,
  error: Error
): Promise<void> {
  await messageStatusUpdater(MessageStatusValueEnum.FAILED);
  winston.error(`CreatedMessageQueueHandler|Unexpected error|${error.message}`);
}

/**
 * Returns left(true) in case the caller must
 * trigger a retry calling context.done(true)
 */
export async function processRuntimeError(
  messageStatusUpdater: MessageStatusUpdater,
  queueService: QueueService,
  error: RuntimeError,
  queueMessage: IQueueMessage
): Promise<Either<boolean, Option<OutputBindings>>> {
  if (isTransient(error)) {
    winston.warn(`CreatedMessageQueueHandler|Transient error|${error.message}`);
    const shouldTriggerARetry = await updateMessageVisibilityTimeout(
      queueService,
      MESSAGE_QUEUE_NAME,
      queueMessage
    );
    return left(shouldTriggerARetry);
  } else {
    winston.error(
      `CreatedMessageQueueHandler|Permanent error|${error.message}`
    );
    await messageStatusUpdater(MessageStatusValueEnum.FAILED);
    // return no bindings so message processing stops here
    return right(none);
  }
}

export async function processSuccess(
  messageStatusUpdater: MessageStatusUpdater,
  notificationStatusModel: NotificationStatusModel,
  notification: RetrievedNotification,
  message: NewMessageWithContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): Promise<Either<never, Option<OutputBindings>>> {
  const emailNotification: NotificationEvent = {
    message: {
      ...message,
      kind: "INewMessageWithContent"
    },
    notificationId: notification.id,
    senderMetadata
  };

  const bindings: OutputBindings = {
    emailNotification
  };

  winston.debug(
    `CreatedMessageQueueHandler|succeeded|message=${
      emailNotification.notificationId
    }|message=${emailNotification.message.id}`
  );

  const notificationStatusUpdater = getNotificationStatusUpdater(
    notificationStatusModel,
    NotificationChannelEnum.EMAIL,
    emailNotification.message.id,
    emailNotification.notificationId
  );

  // status updates are best effort operations, no error checking here
  await notificationStatusUpdater(NotificationChannelStatusValueEnum.QUEUED);
  await messageStatusUpdater(MessageStatusValueEnum.PROCESSED);

  // return Function binding (enqueue a message)
  return right(some(bindings));
}

/**
 * Handler that gets triggered on incoming event.
 */
export async function index(
  context: ContextWithBindings
): Promise<OutputBindings | Error | void> {
  const stopProcessing = undefined;
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
    return stopProcessing;
  }

  const createdMessageEvent = errorOrCreatedMessageEvent.value;
  const newMessageWithContent = createdMessageEvent.message;
  const defaultAddresses = fromNullable(createdMessageEvent.defaultAddresses);
  const senderMetadata = createdMessageEvent.senderMetadata;

  const documentClient = new DocumentDBClient(cosmosDbUri, {
    masterKey: cosmosDbKey
  });

  const messageStatusModel = new MessageStatusModel(
    documentClient,
    messageStatusCollectionUrl
  );

  const messageStatusUpdater = getMessageStatusUpdater(
    messageStatusModel,
    newMessageWithContent.id
  );

  try {
    winston.info(
      `CreatedMessageQueueHandler|A new message was created|${
        newMessageWithContent.id
      }|${newMessageWithContent.fiscalCode}`
    );

    // setup required models

    const profileModel = new ProfileModel(
      documentClient,
      profilesCollectionUrl
    );

    const messageModel = new MessageModel(
      documentClient,
      messagesCollectionUrl,
      messageContainerName
    );

    const notificationModel = new NotificationModel(
      documentClient,
      notificationsCollectionUrl
    );

    const notificationStatusModel = new NotificationStatusModel(
      documentClient,
      notificationStatusCollectionUrl
    );

    const blobService = createBlobService(storageConnectionString);
    const queueService = createQueueService(queueConnectionString);

    // now we can trigger the notifications for the message
    const errorOrNotification = await handleMessage(
      profileModel,
      messageModel,
      notificationModel,
      blobService,
      newMessageWithContent,
      defaultAddresses
    );

    const shouldTriggerARetryOrOutputBindings = await errorOrNotification.fold(
      error =>
        processRuntimeError(
          messageStatusUpdater,
          queueService,
          error,
          context.bindingData
        ),
      notification =>
        processSuccess(
          messageStatusUpdater,
          notificationStatusModel,
          notification,
          newMessageWithContent,
          senderMetadata
        )
    );

    return shouldTriggerARetryOrOutputBindings.fold(
      shouldTriggerARetry => {
        if (shouldTriggerARetry) {
          throw TransientError("retry");
        }
        return stopProcessing;
      },
      // success ! lets see if we have some bindings to output
      outputBindings => outputBindings.toUndefined()
    );
  } catch (error) {
    if (isTransient(error)) {
      throw error;
    }
    await processGenericError(messageStatusUpdater, error);
    return stopProcessing;
  }
}
