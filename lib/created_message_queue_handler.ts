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

import { BlobService, createBlobService } from "azure-storage";

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
import { ProfileModel } from "./models/profile";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { NonEmptyString } from "./utils/strings";
import { Tuple2 } from "./utils/tuples";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

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
 * Bad things that can happen while we process the message
 */
export enum ProcessingError {
  // a transient error, e.g. database is not available
  TRANSIENT,

  // user has no profile and no default addresses have been provided,
  // we can't deliver a notification
  NO_ADDRESSES
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
): Promise<Either<ProcessingError, RetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
    newMessageWithoutContent.fiscalCode
  );

  if (isLeft(errorOrMaybeProfile)) {
    // query failed
    return left(ProcessingError.TRANSIENT);
  }

  // query succeeded, we may have a profile
  const maybeProfile = errorOrMaybeProfile.value;

  // whether the recipient wants us to store the message content
  const isMessageStorageEnabled = maybeProfile.exists(
    profile => profile.isStorageOfMessageContentEnabled === true
  );

  if (isMessageStorageEnabled) {
    // if the recipient wants to store the messages
    // we add the content of the message to the blob storage for later retrieval
    const errorOrAttachment = await messageModel.attachStoredContent(
      blobService,
      newMessageWithoutContent.id,
      newMessageWithoutContent.fiscalCode,
      messageContent
    );

    winston.debug(`handleMessage|${JSON.stringify(newMessageWithoutContent)}`);

    if (isLeft(errorOrAttachment)) {
      // we consider errors while updating message as transient
      return left(ProcessingError.TRANSIENT);
    }
  }

  //
  // attempt to resolve an email notification
  //
  const maybeProfileEmail = maybeProfile
    .chain(profile => fromNullable(profile.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.PROFILE_ADDRESS));
  const maybeDefaultEmail = defaultAddresses
    .chain(addresses => fromNullable(addresses.email))
    .map(email => Tuple2(email, NotificationAddressSourceEnum.DEFAULT_ADDRESS));
  const maybeEmail = maybeProfileEmail.alt(maybeDefaultEmail);
  const maybeEmailNotification: Option<
    NotificationChannelEmail
  > = maybeEmail.map(({ e1: toAddress, e2: addressSource }) => {
    return {
      addressSource,
      status: NotificationChannelStatusEnum.QUEUED,
      toAddress
    };
  });

  // check whether there's at least a channel we can send the notification to
  if (isNone(maybeEmailNotification)) {
    // no channels to notify the user
    return left(ProcessingError.NO_ADDRESSES);
  }

  // create a new Notification object with the configured notification channels
  // only some of the channels may be configured, for the channel that have not
  // generated a notification, we set the field to undefined
  const notification: NewNotification = {
    // if we have an emailNotification, we initialize its status
    emailNotification: maybeEmailNotification.toUndefined(),
    fiscalCode: newMessageWithoutContent.fiscalCode,
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
    return left(ProcessingError.TRANSIENT);
  }

  // save succeeded, return the saved Notification
  return right(result.value);
}

export function processResolve(
  errorOrNotification: Either<ProcessingError, RetrievedNotification>,
  context: ContextWithBindings,
  newMessageWithoutContent: NewMessageWithoutContent,
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

    context.done();
  } else {
    // the processing failed
    switch (errorOrNotification.value) {
      case ProcessingError.NO_ADDRESSES: {
        winston.error(
          `Fiscal code has no associated profile and no default addresses provided|${newMessageWithoutContent.fiscalCode}`
        );
        context.done();
        break;
      }
      case ProcessingError.TRANSIENT: {
        winston.error(
          `Transient error, retrying|${newMessageWithoutContent.fiscalCode}`
        );
        context.done("Transient error"); // here we trigger a retry by calling
        // done(error)
        break;
      }
    }
  }
}

export function processReject(
  context: ContextWithBindings,
  newMessageWithoutContent: NewMessageWithoutContent,
  error: Either<ProcessingError, RetrievedNotification>
): void {
  // the promise failed
  winston.error(
    `Error while processing event, retrying|${newMessageWithoutContent.fiscalCode}|${error}`
  );
  // in case of error, we return a failure to trigger a retry (up to the
  // configured max retries) TODO: schedule next retry with exponential
  // backoff, see #150597257
  context.done(error);
}

/**
 * Handler that gets triggered on incoming event.
 */
export function index(context: ContextWithBindings): void {
  // redirect winston logs to Azure Functions log
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  winston.debug(`bindings|${JSON.stringify(context.bindings)}`);

  const createdMessageEvent = context.bindings.createdMessage;
  winston.debug(`createdMessageEvent|${JSON.stringify(createdMessageEvent)}`);

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (!CreatedMessageEvent.is(createdMessageEvent)) {
    winston.error(`Fatal! No valid message found in bindings.`);
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
    `A new message was created|${newMessageWithoutContent.id}|${newMessageWithoutContent.fiscalCode}`
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

  // now we can trigger the notifications for the message
  handleMessage(
    profileModel,
    messageModel,
    notificationModel,
    blobService,
    newMessageWithoutContent,
    messageContent,
    defaultAddresses
  ).then(
    (errorOrNotification: Either<ProcessingError, RetrievedNotification>) => {
      processResolve(
        errorOrNotification,
        context,
        newMessageWithoutContent,
        messageContent,
        senderMetadata
      );
    },
    (error: Either<ProcessingError, RetrievedNotification>) => {
      processReject(context, newMessageWithoutContent, error);
    }
  );
}

/*
2017-08-14T13:58:19.356 Queue trigger function processed work item { messageId: '5991ac7944430d3670b81b74' }
2017-08-14T13:58:19.356 queueTrigger = {"messageId":"5991ac7944430d3670b81b74"}
2017-08-14T13:58:19.356 expirationTime = 8/21/2017 1:58:17 PM +00:00
2017-08-14T13:58:19.356 insertionTime = 8/14/2017 1:58:17 PM +00:00
2017-08-14T13:58:19.356 nextVisibleTime = 8/14/2017 2:08:19 PM +00:00
2017-08-14T13:58:19.356 id= 5f149158-92fa-4aaf-84c9-667750fdfaad
2017-08-14T13:58:19.356 popReceipt = AgAAAAMAAAAAAAAAtS7dxwYV0wE=
2017-08-14T13:58:19.356 dequeueCount = 1
*/
