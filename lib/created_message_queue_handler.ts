/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import {
  ICreatedMessageEvent,
  isICreatedMessageEvent,
} from "./models/created_message_event";
import { IRetrievedMessage } from "./models/message";
import {
  IRetrievedNotification,
  NotificationModel,
} from "./models/notification";
import { INotificationEvent } from "./models/notification_event";
import { ProfileModel } from "./models/profile";
import {
  handleMessage,
  ProcessingError,
} from "./queue_handlers/queued_message_handler";
import { Either } from "./utils/either";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

// TODO: read from env vars
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri("development");
const profilesCollectionUrl = documentDbUtils.getCollectionUri(documentDbDatabaseUrl, "profiles");
const notificationsCollectionUrl = documentDbUtils.getCollectionUri(documentDbDatabaseUrl, "notifications");

//
// Main function
//

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
export interface IContextWithBindings extends IContext {
  readonly bindings: {

    // input bindings
    readonly createdMessage?: ICreatedMessageEvent;

    // output bindings
    // tslint:disable-next-line:readonly-keyword
    emailNotification?: INotificationEvent;

  };
}

export function processResolve(errorOrNotification: Either<ProcessingError, IRetrievedNotification>,
                               context: IContextWithBindings,
                               retrievedMessage: IRetrievedMessage): void {
  if (errorOrNotification.isRight) {
    // the notification has been created
    const notification = errorOrNotification.right;

    if (notification.emailNotification) {
      // the notification object has been created with an email channel
      // we output a notification event to the email channel queue

      // tslint:disable-next-line:no-object-mutation
      context.bindings.emailNotification = {
        messageId: notification.messageId,
        notificationId: notification.id,
      };
    }

    context.done();
  } else {
    // the processing failed
    switch (errorOrNotification.left) {
      case ProcessingError.NO_PROFILE: {
        context.log.error(`Fiscal code has no associated profile|${retrievedMessage.fiscalCode}`);
        context.done();
        break;
      }
      case ProcessingError.TRANSIENT: {
        context.log.error(`Transient error, retrying|${retrievedMessage.fiscalCode}`);
        context.done("Transient error"); // here we trigger a retry by calling
                                         // done(error)
        break;
      }
    }
  }
}

export function processReject(context: IContextWithBindings,
                              retrievedMessage: IRetrievedMessage,
                              error: Either<ProcessingError, IRetrievedNotification>): void {
  // the promise failed
  context.log.error(`Error while processing event, retrying|${retrievedMessage.fiscalCode}|${error}`);
  // in case of error, we return a failure to trigger a retry (up to the
  // configured max retries) TODO: schedule next retry with exponential
  // backoff, see #150597257
  context.done(error);
}

/**
 * Handler that gets triggered on incoming event.
 */
export function index(context: IContextWithBindings): void {
  const createdMessageEvent = context.bindings.createdMessage;

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (createdMessageEvent === undefined || !isICreatedMessageEvent(createdMessageEvent)) {
    context.log.error(`Fatal! No valid message found in bindings.`);
    // we will never be able to recover from this, so don't trigger an error
    // TODO: perhaps forward this message to a failed events queue for review
    context.done();
    return;
  }

  // it is an ICreatedMessageEvent
  const retrievedMessage = createdMessageEvent.message;

  context.log(`A new message was created|${retrievedMessage.id}|${retrievedMessage.fiscalCode}`);

  // setup required models
  const documentClient = new DocumentDBClient(COSMOSDB_URI, {masterKey: COSMOSDB_KEY});
  const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
  const notificationModel = new NotificationModel(documentClient, notificationsCollectionUrl);

  // now we can trigger the notifications for the message
  handleMessage(
      profileModel,
      notificationModel,
      retrievedMessage,
  ).then((errorOrNotification) => {
        processResolve(errorOrNotification, context, retrievedMessage);
      },
      (error) => {
        processReject(context, retrievedMessage, error);
      });
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
