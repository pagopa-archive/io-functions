/*
* This function will process events triggered by newly created messages.
* For each new input message, the delivery preferences associated to the
* recipient of the message gets retrieved and a notification gets delivered
* to each configured channel.
*/

import * as t from "io-ts";

import { ulid } from "ulid";
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
import { NotificationChannelStatusEnum } from "./api/definitions/NotificationChannelStatus";

import { getRequiredStringEnv } from "./utils/env";

import { CreatedMessageEvent } from "./models/created_message_event";
import { MessageModel, NewMessageWithoutContent } from "./models/message";
import {
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel,
  RetrievedNotification
} from "./models/notification";
import { NotificationEvent } from "./models/notification_event";
import { ProfileModel, RetrievedProfile } from "./models/profile";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { NonEmptyString } from "./utils/strings";
import { Tuple2 } from "./utils/tuples";
import { ReadableReporter } from "./utils/validation_reporters";

import { retryMessageEnqueue } from "./utils/azure_queues";
import {
  isTransient,
  PermanentError,
  RuntimeError,
  TransientError
} from "./utils/errors";

import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";

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
    // tslint:disable-next-line:readonly-keyword
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
function getEmailNotification(
  maybeProfile: Option<RetrievedProfile>,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Option<NotificationChannelEmail> {
  const maybeProfileEmail = maybeProfile
    .chain(profile => fromNullable(profile.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.PROFILE_ADDRESS));
  const maybeDefaultEmail = defaultAddresses
    .chain(addresses => fromNullable(addresses.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.DEFAULT_ADDRESS));
  const maybeEmail = maybeProfileEmail.alt(maybeDefaultEmail);
  return maybeEmail.map(({ e1: toAddress, e2: addressSource }) => {
    return {
      addressSource,
      status: NotificationChannelStatusEnum.QUEUED,
      toAddress
    };
  });
}

/**
 * Handles the retrieved message by looking up the associated profile and
 * creating a Notification record that has all the channels configured.
 *
 * TODO: emit to all channels (push notification, sms, etc...)
 *
 * Returns left(TransientError) in case of recoverable errors.
 * Returns left(Error) in case of permanent errors.
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
    // It's critical to trigger a retry here
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

  // attempt to resolve an email notification
  const maybeEmailNotification = getEmailNotification(
    maybeProfile,
    defaultAddresses
  );

  // check whether there's at least a channel we can send the notification to
  if (isNone(maybeEmailNotification)) {
    // no channels to notify the user
    return left(
      PermanentError(
        `Fiscal code has no associated email address and no default addresses was provided|${
          newMessageWithoutContent.fiscalCode
        }`
      )
    );
  }

  // create a new Notification object with the configured notification channels
  // only some of the channels may be configured, for the channel that have not
  // generated a notification, we set the field to undefined
  const notification: NewNotification = {
    // if we have an emailNotification, we initialize its status
    emailNotification: maybeEmailNotification.toUndefined(),
    fiscalCode: newMessageWithoutContent.fiscalCode,
    // tslint:disable-next-line:no-useless-cast
    id: ulid() as NonEmptyString,
    kind: "INewNotification",
    messageId: newMessageWithoutContent.id
  };

  // save the Notification
  const result = await notificationModel.create(
    notification,
    notification.messageId
  );

  if (isLeft(result)) {
    return left(TransientError("Cannot save notification to database"));
  }

  // save succeeded, return the saved Notification
  return right(result.value);
}

export function processResolve(
  errorOrNotification: Either<RuntimeError, RetrievedNotification>,
  context: ContextWithBindings,
  messageContent: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): void {
  if (isRight(errorOrNotification)) {
    const notification = errorOrNotification.value;
    // TODO: handle all notification channels
    // the notification object has been created with an email channel
    // we output a notification event to the email channel queue
    if (notification.emailNotification) {
      // tslint:disable-next-line:no-object-mutation
      context.bindings.emailNotification = {
        messageContent,
        messageId: notification.messageId,
        notificationId: notification.id,
        senderMetadata
      };
    }
    // TODO: update message status (queued_at)
  } else if (isTransient(errorOrNotification.value)) {
    const transientError = errorOrNotification.value;
    winston.error(
      `CreatedMessageQueueHandler|Transient error|${transientError.message}`
    );
    // schedule a retry in case of transient errors
    // retry function is async and calls context.done() by itself
    const queueService = createQueueService(queueConnectionString);
    return retryMessageEnqueue(queueService, MESSAGE_QUEUE_NAME, context);
  } else {
    // the processing failed with an unrecoverable error
    // TODO: update message status (failed_at)
    const permanentError = errorOrNotification.value;
    winston.error(
      `CreatedMessageQueueHandler|Permanent error|${permanentError.message}`
    );
  }
  return context.done();
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
      `CreatedMessageQueueHandler|queueMessage|${context.bindings}`
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
