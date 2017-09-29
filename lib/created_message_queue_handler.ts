/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as ulid from "ulid";
import * as winston from "winston";

import { IContext } from "azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import { configureAzureContextTransport } from "./utils/logging";

import * as documentDbUtils from "./utils/documentdb";

import { Option, option } from "ts-option";

import { BlobService, createBlobService } from "azure-storage";

import { NewMessageDefaultAddresses } from "./api/definitions/NewMessageDefaultAddresses";
import { NotificationChannelStatus } from "./api/definitions/NotificationChannelStatus";

import {
  ICreatedMessageEvent,
  isICreatedMessageEvent
} from "./models/created_message_event";
import { ICreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import {
  IMessageContent,
  IRetrievedMessageWithoutContent,
  MessageModel
} from "./models/message";
import {
  INewNotification,
  INotificationChannelEmail,
  IRetrievedNotification,
  NotificationAddressSource,
  NotificationModel
} from "./models/notification";
import { INotificationEvent } from "./models/notification_event";
import { ProfileModel } from "./models/profile";

import { Either, left, right } from "./utils/either";
import { toNonEmptyString } from "./utils/strings";
import { Tuple2 } from "./utils/tuples";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const MESSAGE_CONTAINER_NAME: string = process.env.MESSAGE_CONTAINER_NAME;

// TODO: read from env vars
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri("development");
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

const STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage;

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IContextWithBindings extends IContext {
  readonly bindings: {
    // input bindings
    readonly createdMessage?: ICreatedMessageEvent;

    // output bindings
    // tslint:disable-next-line:readonly-keyword
    emailNotification?: INotificationEvent;
  };
}

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
  retrievedMessage: IRetrievedMessageWithoutContent,
  messageContent: IMessageContent,
  defaultAddresses: Option<NewMessageDefaultAddresses>
): Promise<Either<ProcessingError, IRetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
    retrievedMessage.fiscalCode
  );

  if (errorOrMaybeProfile.isLeft) {
    // query failed
    return left(ProcessingError.TRANSIENT);
  }

  // query succeeded, we may have a profile
  const maybeProfile = errorOrMaybeProfile.right;

  // whether the recipient wants us to store the message content
  const isMessageStorageEnabled = maybeProfile.exists(
    profile => profile.isStorageOfMessageContentEnabled === true
  );

  if (isMessageStorageEnabled) {
    // if the recipient wants to store the messages
    // we add the content of the message to the blob storage for later retrieval
    const errorOrAttachment = await messageModel.attachStoredContent(
      blobService,
      retrievedMessage.id,
      retrievedMessage.fiscalCode,
      messageContent
    );

    winston.debug(`handleMessage|${JSON.stringify(retrievedMessage)}`);

    if (errorOrAttachment.isLeft) {
      // we consider errors while updating message as transient
      return left(ProcessingError.TRANSIENT);
    }
  }

  //
  // attempt to resolve an email notification
  //
  const maybeProfileEmail = maybeProfile
    .flatMap(profile => option(profile.email))
    .map(email => Tuple2(email, NotificationAddressSource.PROFILE_ADDRESS));
  const maybeDefaultEmail = defaultAddresses
    .flatMap(addresses => option(addresses.email))
    .map(email => Tuple2(email, NotificationAddressSource.DEFAULT_ADDRESS));
  const maybeEmail = maybeProfileEmail.orElse(() => maybeDefaultEmail);
  const maybeEmailNotification: Option<
    INotificationChannelEmail
  > = maybeEmail.map(({ e1: toAddress, e2: addressSource }) => {
    return {
      addressSource,
      status: NotificationChannelStatus.QUEUED,
      toAddress
    };
  });

  // check whether there's at least a channel we can send the notification to
  if (maybeEmailNotification.isEmpty) {
    // no channels to notify the user
    return left(ProcessingError.NO_ADDRESSES);
  }

  // create a new Notification object with the configured notification channels
  // only some of the channels may be configured, for the channel that have not
  // generated a notification, we set the field to undefined
  const notification: INewNotification = {
    // if we have an emailNotification, we initialize its status
    emailNotification: maybeEmailNotification.isDefined
      ? maybeEmailNotification.get
      : undefined,
    fiscalCode: retrievedMessage.fiscalCode,
    id: toNonEmptyString(ulid()).get,
    kind: "INewNotification",
    messageId: retrievedMessage.id
  };

  // save the Notification
  const result = await notificationModel.create(
    notification,
    notification.messageId
  );

  if (result.isLeft) {
    // saved failed, fail with a transient error
    // TODO: we could check the error to see if it's actually transient
    return left(ProcessingError.TRANSIENT);
  }

  // save succeeded, return the saved Notification
  return right(result.right);
}

export function processResolve(
  errorOrNotification: Either<ProcessingError, IRetrievedNotification>,
  context: IContextWithBindings,
  retrievedMessage: IRetrievedMessageWithoutContent,
  messageContent: IMessageContent,
  senderMetadata: ICreatedMessageEventSenderMetadata
): void {
  if (errorOrNotification.isRight) {
    // the notification has been created
    const notification = errorOrNotification.right;

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
    switch (errorOrNotification.left) {
      case ProcessingError.NO_ADDRESSES: {
        winston.error(
          `Fiscal code has no associated profile and no default addresses provided|${retrievedMessage.fiscalCode}`
        );
        context.done();
        break;
      }
      case ProcessingError.TRANSIENT: {
        winston.error(
          `Transient error, retrying|${retrievedMessage.fiscalCode}`
        );
        context.done("Transient error"); // here we trigger a retry by calling
        // done(error)
        break;
      }
    }
  }
}

export function processReject(
  context: IContextWithBindings,
  retrievedMessage: IRetrievedMessageWithoutContent,
  error: Either<ProcessingError, IRetrievedNotification>
): void {
  // the promise failed
  winston.error(
    `Error while processing event, retrying|${retrievedMessage.fiscalCode}|${error}`
  );
  // in case of error, we return a failure to trigger a retry (up to the
  // configured max retries) TODO: schedule next retry with exponential
  // backoff, see #150597257
  context.done(error);
}

/**
 * Handler that gets triggered on incoming event.
 */
export function index(context: IContextWithBindings): void {
  // redirect winston logs to Azure Functions log
  configureAzureContextTransport(context, winston, "debug");
  winston.debug(`bindings|${JSON.stringify(context.bindings)}`);

  const createdMessageEvent = context.bindings.createdMessage;
  winston.debug(`createdMessageEvent|${JSON.stringify(createdMessageEvent)}`);

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (
    createdMessageEvent === undefined ||
    !isICreatedMessageEvent(createdMessageEvent)
  ) {
    winston.error(`Fatal! No valid message found in bindings.`);
    // we will never be able to recover from this, so don't trigger an error
    // TODO: perhaps forward this message to a failed events queue for review
    context.done();
    return;
  }

  // it is an ICreatedMessageEvent
  const retrievedMessage = createdMessageEvent.message;
  const messageContent = createdMessageEvent.messageContent;
  const defaultAddresses = option(createdMessageEvent.defaultAddresses);
  const senderMetadata = createdMessageEvent.senderMetadata;

  winston.info(
    `A new message was created|${retrievedMessage.id}|${retrievedMessage.fiscalCode}`
  );

  // setup required models
  const documentClient = new DocumentDBClient(COSMOSDB_URI, {
    masterKey: COSMOSDB_KEY
  });
  const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
  const messageModel = new MessageModel(
    documentClient,
    messagesCollectionUrl,
    toNonEmptyString(MESSAGE_CONTAINER_NAME).get
  );
  const notificationModel = new NotificationModel(
    documentClient,
    notificationsCollectionUrl
  );

  const blobService = createBlobService(STORAGE_CONNECTION_STRING);

  // now we can trigger the notifications for the message
  handleMessage(
    profileModel,
    messageModel,
    notificationModel,
    blobService,
    retrievedMessage,
    messageContent,
    defaultAddresses
  ).then(
    (errorOrNotification: Either<ProcessingError, IRetrievedNotification>) => {
      processResolve(
        errorOrNotification,
        context,
        retrievedMessage,
        messageContent,
        senderMetadata
      );
    },
    (error: Either<ProcessingError, IRetrievedNotification>) => {
      processReject(context, retrievedMessage, error);
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
