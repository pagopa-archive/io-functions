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

import { fromNullable, isNone, Option } from "fp-ts/lib/Option";

import {
  BlobService,
  createBlobService,
  createQueueService
} from "azure-storage";

import { MessageContent } from "./api/definitions/MessageContent";
import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";

import { getRequiredStringEnv } from "./utils/env";

import { CreatedMessageEvent } from "./models/created_message_event";
import { MessageModel, NewMessageWithoutContent } from "./models/message";
import {
  createNewNotification,
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel,
  RetrievedNotification
} from "./models/notification";
import { NotificationEvent } from "./models/notification_event";
import { ProfileModel, RetrievedProfile } from "./models/profile";

import { Either, isLeft, left } from "fp-ts/lib/Either";
import { Tuple2 } from "./utils/tuples";
import { ReadableReporter } from "./utils/validation_reporters";

import { retryMessageEnqueue } from "./utils/azure_queues";
import {
  isTransient,
  PermanentError,
  RuntimeError,
  TransientError
} from "./utils/errors";

import { EmailAddress } from "./api/definitions/EmailAddress";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
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

// must be equal to the queue name in function.json
export const MESSAGE_QUEUE_NAME = "createdmessages";

const messageContainerName = getRequiredStringEnv("MESSAGE_CONTAINER_NAME");
const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
const ContextWithBindings = t.interface({
  bindings: t.partial({
    // input bindings
    createdMessage: CreatedMessageEvent,

    // output bindings
    emailNotification: NotificationEvent
  })
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
 * Save a notification object to the database.
 *
 * @param notificationModel notification model used to interact with database
 * @param notifications     array of notification objects
 */
async function saveNotification(
  notificationModel: NotificationModel,
  notification: NewNotification
): Promise<Either<TransientError, RetrievedNotification>> {
  return (await notificationModel.create(
    notification,
    notification.messageId
  )).mapLeft(() => {
    winston.debug(
      `saveNotification|Error|Cannot save notification to database|${JSON.stringify(
        notification
      )})`
    );
    return TransientError("Cannot save notification to database");
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
  newMessageWithoutContent: NewMessageWithoutContent,
  messageContent: MessageContent,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Promise<Either<RuntimeError, RetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
    newMessageWithoutContent.fiscalCode
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
      newMessageWithoutContent.id,
      newMessageWithoutContent.fiscalCode,
      messageContent
    );

    winston.debug(
      `handleMessage|attachStoredContent|${JSON.stringify(
        newMessageWithoutContent
      )}`
    );

    if (isLeft(errorOrAttachment)) {
      winston.error(`handleMessage|${JSON.stringify(errorOrAttachment)}`);
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
          newMessageWithoutContent.fiscalCode
        }`
      )
    );
  }

  const newNotification = createNewNotification(
    ulidGenerator,
    newMessageWithoutContent.fiscalCode,
    newMessageWithoutContent.id
  );

  return saveNotification(notificationModel, {
    ...newNotification,
    channels: {
      [NotificationChannelEnum.EMAIL]: maybeNotificationChannelEmail.toUndefined()
    }
  });
}

export function processResolve(
  errorOrNotification: Either<RuntimeError, RetrievedNotification>,
  context: ContextWithBindings,
  message: NewMessageWithoutContent,
  messageContent: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): void {
  if (isLeft(errorOrNotification)) {
    const error = errorOrNotification.value;
    if (isTransient(error)) {
      winston.error(
        `CreatedMessageQueueHandler|Transient error|${error.message}`
      );
      // schedule a retry in case of transient errors
      // retry function is async and calls context.done() by itself
      // TODO: update message status (PROCESSING)
      const queueService = createQueueService(queueConnectionString);
      return retryMessageEnqueue(queueService, MESSAGE_QUEUE_NAME, context);
    } else {
      // the message processing failed with an unrecoverable error
      // TODO: update message status (FAILED)
      winston.error(
        `CreatedMessageQueueHandler|Permanent error|${error.message}`
      );
      return context.done();
    }
  }

  const notification = errorOrNotification.value;

  const emailNotification: NotificationEvent = {
    message: {
      ...message,
      content: messageContent,
      kind: "INewMessageWithContent"
    },
    notificationId: notification.id,
    senderMetadata
  };

  const bindings = {
    emailNotification
  };

  winston.debug(
    `CreatedMessageQueueHandler|binding|${JSON.stringify(bindings)}`
  );
  // TODO: update message status (ACCEPTED)
  context.done(undefined, bindings);
}

/**
 * Handler that gets triggered on incoming event.
 */
export function index(context: ContextWithBindings): void {
  try {
    // redirect winston logs to Azure Functions log
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
    const validation = CreatedMessageEvent.decode(
      context.bindings.createdMessage
    );
    if (isLeft(validation)) {
      winston.error(
        `CreatedMessageQueueHandler|Fatal! No valid message found in bindings.`
      );
      winston.debug(
        `CreatedMessageQueueHandler|validationError|${ReadableReporter.report(
          validation
        ).join("\n")}`
      );
      // we will never be able to recover from this, so don't trigger an error
      // TODO: update message status (failed_at)
      return context.done();
    }

    const createdMessageEvent = validation.value;

    // it is an CreatedMessageEvent
    const newMessageWithoutContent = createdMessageEvent.message;
    const messageContent = createdMessageEvent.messageContent;
    const defaultAddresses = fromNullable(createdMessageEvent.defaultAddresses);
    const senderMetadata = createdMessageEvent.senderMetadata;

    winston.info(
      `CreatedMessageQueueHandler|A new message was created|${
        newMessageWithoutContent.id
      }|${newMessageWithoutContent.fiscalCode}`
    );

    // setup required models
    const documentClient = new DocumentDBClient(cosmosDbUri, {
      masterKey: cosmosDbKey
    });
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

    const blobService = createBlobService(storageConnectionString);

    // now we can trigger the notifications for the message
    handleMessage(
      profileModel,
      messageModel,
      notificationModel,
      blobService,
      newMessageWithoutContent,
      messageContent,
      defaultAddresses
    )
      .then(errorOrNotification => {
        return processResolve(
          errorOrNotification,
          context,
          newMessageWithoutContent,
          messageContent,
          senderMetadata
        );
      })
      .catch(error => {
        // Some unexpected exception occurred inside the promise.
        // We consider this event as a permanent unrecoverable error.
        // TODO: update message status (failed_at)
        winston.error(
          `CreatedMessageQueueHandler|Unexpected error|${
            newMessageWithoutContent.id
          }|${newMessageWithoutContent.fiscalCode}|${error.message}|${
            error.stack
          }`
        );
        context.done();
      });
  } catch (error) {
    // Avoid poison queue in case of unexpected errors occurred outside handleMessage()
    // (shouldn't happen)
    // TODO: update message status (failed_at)
    winston.error(
      `CreatedMessageQueueHandler|Exception caught|${error.message}|${
        error.stack
      }`
    );
    context.done();
  }
}
