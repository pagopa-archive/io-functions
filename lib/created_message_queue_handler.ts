/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as ulid from "ulid";

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import { Option, option } from "ts-option";
import { Either, left, right } from "./utils/either";

import * as documentDbUtils from "./utils/documentdb";

import { ICreatedMessageEvent, isICreatedMessageEvent } from "./models/created_message_event";
import { IRetrievedMessage } from "./models/message";
import {
  INewNotification,
  INotificationChannelEmail,
  IRetrievedNotification,
  NotificationChannelStatus,
  NotificationModel,
} from "./models/notification";
import { INotificationEvent } from "./models/notification_event";
import { ProfileModel } from "./models/profile";

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
enum ProcessingError {

  // a transient error, e.g. database is not available
  TRANSIENT,

  // user has no profile, can't deliver a notification
  NO_PROFILE,

}

/**
 * Handles the retrieved message by looking up the associated profile and
 * creating a Notification record that has all the channels configured.
 *
 * TODO: emit to all channels (push notification, sms, etc...)
 */
async function handleMessage(
  profileModel: ProfileModel,
  notificationModel: NotificationModel,
  retrievedMessage: IRetrievedMessage,
): Promise<Either<ProcessingError, IRetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(retrievedMessage.fiscalCode);

  if (errorOrMaybeProfile.isRight) {
    // query succeeded, let's see if we have a result
    const maybeProfile = errorOrMaybeProfile.right;
    if (maybeProfile.isDefined) {
      // yes we have a matching profile
      const profile = maybeProfile.get;
      // we got a valid profile associated to the message, we can trigger
      // notifications on the configured channels.

      const maybeEmailNotification: Option<INotificationChannelEmail> = option(profile.email).map((email) => {
        // in case an email address is configured in the profile, we can
        // trigger an email notification event
        const emailNotification: INotificationChannelEmail = {
          status: NotificationChannelStatus.NOTIFICATION_QUEUED,
          toAddress: email,
        };
        return emailNotification;
      });

      // create a new Notification object with the configured notifications
      const notification: INewNotification = {
        emailNotification: maybeEmailNotification.isDefined ? maybeEmailNotification.get : undefined,
        fiscalCode: profile.fiscalCode,
        id: ulid(),
        kind: "INewNotification",
        messageId: retrievedMessage.id,
      };

      // save the Notification
      const result = await notificationModel.create(notification, notification.messageId);

      if (result.isRight) {
        // save succeeded, return the saved Notification
        return right(result.right);
      } else {
        // saved failed, fail with a transient error
        // TODO: we could check the error to see if it's actually transient
        return left(ProcessingError.TRANSIENT);
      }

    } else {
      // query succeeded but no profile was found
      return(left(ProcessingError.NO_PROFILE));
    }
  } else {
    // query failed
    return left(ProcessingError.TRANSIENT);
  }

}

/**
 * Handler that gets triggerend on incoming event.
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
  const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });
  const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
  const notificationModel = new NotificationModel(documentClient, notificationsCollectionUrl);

  // now we can trigger the notifications for the message
  handleMessage(
    profileModel,
    notificationModel,
    retrievedMessage,
  ).then((errorOrNotification) => {
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
          context.done("Transient error"); // here we trigger a retry by calling done(error)
          break;
        }
      }
    }
  },
  (error) => {
    // the promise failed
    context.log.error(`Error while processing event, retrying|${retrievedMessage.fiscalCode}|${error}`);
    // in case of error, we return a failure to trigger a retry (up to the configured max retries)
    // TODO: schedule next retry with exponential backoff, see #150597257
    context.done(error);
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
