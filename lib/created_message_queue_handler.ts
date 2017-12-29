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
  createQueueService,
  QueueService
} from "azure-storage";

import { MessageContent } from "./api/definitions/MessageContent";
import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";
import { NotificationChannelStatusEnum } from "./api/definitions/NotificationChannelStatus";

import { getRequiredStringEnv } from "./utils/env";

import { CreatedMessageEvent } from "./models/created_message_event";
import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
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

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

const MAX_RETRIES = 5;

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");
const messageContainerName = getRequiredStringEnv("MESSAGE_CONTAINER_NAME");

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

function queueMessageToString(context: ContextWithBindings): string {
  return [
    "Work item",
    context.bindings.createdMessage,
    "queueTrigger =",
    context.bindingData.queueTrigger,
    "expirationTime =",
    context.bindingData.expirationTime,
    "insertionTime =",
    context.bindingData.insertionTime,
    "nextVisibleTime =",
    context.bindingData.nextVisibleTime,
    "id =",
    context.bindingData.id,
    "popReceipt =",
    context.bindingData.popReceipt,
    "dequeueCount =",
    context.bindingData.dequeueCount
  ].join(";");
}

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
 */
export async function handleMessage(
  profileModel: ProfileModel,
  messageModel: MessageModel,
  notificationModel: NotificationModel,
  blobService: BlobService,
  newMessageWithoutContent: NewMessageWithoutContent,
  messageContent: MessageContent,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Promise<Either<Error, RetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
    newMessageWithoutContent.fiscalCode
  );

  if (isLeft(errorOrMaybeProfile)) {
    // The query has failed.
    // It's critical to trigger a retry here
    // otherwise no message content will be saved
    throw new Error("Cannot get user's profile");
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
    // In case of retry this will overwrite the message content with itself
    // (we don't know if the operation succeeded at first)
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
      // we consider errors while updating message content as transient
      throw new Error("Cannot store message content");
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
      new Error(
        `No default addresses provided and none found in profile|${
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
    // saved failed, fail with a transient error
    // TODO: we could check the error to see if it's actually transient
    throw new Error("Cannot save notification to database");
  }

  // save succeeded, return the saved Notification
  return right(result.value);
}

/**
 * Handles success and/or permanent failures.
 */
export function processResolve(
  errorOrNotification: Either<Error, RetrievedNotification>,
  context: ContextWithBindings,
  messageContent: MessageContent,
  senderMetadata: CreatedMessageEventSenderMetadata
): void {
  if (isRight(errorOrNotification)) {
    // the notification has been created
    const notification = errorOrNotification.value;

    if (notification.emailNotification) {
      // the notification object has been created with an email channel
      // we output a notification event to the email channel queue

      // tslint:disable-next-line:no-object-mutation
      context.bindings.emailNotification = {
        messageContent,
        messageId: notification.messageId,
        notificationId: notification.id,
        senderMetadata
      };
    }
  } else {
    // the processing failed with an unrecoverable error
    winston.error(errorOrNotification.value.message);
  }
  context.done();
}

/**
 * Handles temporay failures.
 * ie. the promise failed (async function throws)
 */
export function processReject(
  context: ContextWithBindings,
  queueService: QueueService,
  createdMessageEvent: CreatedMessageEvent,
  error: Error
): void {
  winston.error(
    `Error while processing event, retrying|${
      createdMessageEvent.message.fiscalCode
    }:${createdMessageEvent.message.id}|${error.message}`
  );
  const retries = context.bindingData.dequeueCount;
  // We handle transient errore triggering a retry
  // TODO: check time to live
  // TODO: dequeCount is only for old message and wont work here
  //  we need a retries field on the message
  if (retries < MAX_RETRIES) {
    // timeout in seconds before the message can be processed again
    const timeout = Math.min(3600 * 24, Math.pow(10, retries));
    winston.debug(
      `Retrying with timeout|${createdMessageEvent.message.fiscalCode}:${
        createdMessageEvent.message.id
      }|${timeout} seconds`
    );
    queueService.updateMessage(
      "createdmessages",
      context.bindingData.id,
      context.bindingData.popReceipt,
      timeout,
      err => {
        if (err) {
          // cannot enqueue a message, retry the whole procedure
          context.done(err);
        } else {
          // put the item in the queue again
          context.done(error.message);
        }
      }
    );
    // queueService.createMessage(
    //   "createdmessages-poison",
    //   CreatedMessageEvent.serialize(createdMessageEvent),
    //   {
    //     visibilityTimeout: timeout
    //   },
    //   err => {
    //     if (err) {
    //       // cannot enqueue a message, retry the whole procedure
    //       context.done(err);
    //     } else {
    //       context.done();
    //     }
    //   }
    // );
  } else {
    // maximum retries reached,
    // removes the message from the queue
    context.done();
  }
}

/**
 * Handler that gets triggered on incoming event.
 */
export function index(context: ContextWithBindings): void {
  // redirect winston logs to Azure Functions log
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(
    `CreatedMessageQueueHandlerIndex|queueMessage|${queueMessageToString(
      context
    )}`
  );

  const createdMessageEvent = context.bindings.createdMessage;

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (!CreatedMessageEvent.is(createdMessageEvent)) {
    winston.error(`Fatal! No valid message found in bindings.`);

    const validation = t.validate(createdMessageEvent, CreatedMessageEvent);
    winston.debug(
      `CreatedMessageQueueHandlerIndex|validationError|${ReadableReporter.report(
        validation
      ).join("\n")}`
    );

    // we will never be able to recover from this, so don't trigger an error
    // TODO: perhaps forward this message to a failed events queue for review
    context.done();
    return;
  }

  // it is an CreatedMessageEvent
  const newMessageWithoutContent = createdMessageEvent.message;
  const messageContent = createdMessageEvent.messageContent;
  const defaultAddresses = fromNullable(createdMessageEvent.defaultAddresses);
  const senderMetadata = createdMessageEvent.senderMetadata;

  winston.info(
    `A new message was created|${newMessageWithoutContent.id}|${
      newMessageWithoutContent.fiscalCode
    }`
  );

  // setup required models
  const documentClient = new DocumentDBClient(cosmosDbUri, {
    masterKey: cosmosDbKey
  });
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
  const queueService = createQueueService(queueConnectionString);

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
    .then((errorOrNotification: Either<Error, RetrievedNotification>) => {
      processResolve(
        errorOrNotification,
        context,
        messageContent,
        senderMetadata
      );
    })
    .catch((error: Error) => {
      processReject(context, queueService, createdMessageEvent, error);
    });
}
