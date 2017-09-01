/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import { Either, left, right } from "./utils/either";

import * as documentDbUtils from "./utils/documentdb";

import { ICreatedMessageEvent, isICreatedMessageEvent } from "./models/created_message_event";
import { IEmailNotificationEvent } from "./models/email_notification_event";
import { IRetrievedMessage } from "./models/message";
import { ProfileModel } from "./models/profile";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

// TODO: read from env vars
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl("development");
const profilesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "profiles");

const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);

//
// Main function
//

enum ProcessingErrors {
  TRANSIENT,
  NO_PROFILE,
  NO_EMAIL,
}

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IContextWithBindings extends IContext {
  readonly bindings: {
    readonly createdMessage?: ICreatedMessageEvent;
    // tslint:disable-next-line:readonly-keyword
    emailNotification?: IEmailNotificationEvent;
  };
}

async function handleMessage(
  retrievedMessage: IRetrievedMessage,
): Promise<Either<ProcessingErrors, IEmailNotificationEvent>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(retrievedMessage.fiscalCode);

  if (errorOrMaybeProfile.isRight) {
    const maybeProfile = errorOrMaybeProfile.right;
    if (maybeProfile.isDefined) {
      const profile = maybeProfile.get;
      // we got a valid profile associated to the message, we can trigger
      // notifications on the configured channels.
      // TODO: emit to all channels (push notification, sms, etc...)

      // in case an email address is configured in the profile, we can
      // trigger an email notification event
      // context.log.verbose(`Queing email notification|${errorOrMaybeProfile.email}|${retrievedMessage.bodyShort}`);
      if (profile.email !== undefined) {
        const emailNotification: IEmailNotificationEvent = {
          message: retrievedMessage,
          recipients: [ profile.email ],
        };
        return(right(emailNotification));
      } else {
        return(left(ProcessingErrors.NO_EMAIL));
      }
    } else {
      return(left(ProcessingErrors.NO_PROFILE));
    }
  } else {
    return left(ProcessingErrors.TRANSIENT);
  }

}

/**
 * Function handler
 */
export function index(context: IContextWithBindings): void {
  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (context.bindings.createdMessage !== undefined && isICreatedMessageEvent(context.bindings.createdMessage)) {
    // it is an ICreatedMessageEvent
    const createdMessageEvent = context.bindings.createdMessage;
    context.log(`Dequeued message|${createdMessageEvent.message.fiscalCode}`);

    const retrievedMessage = createdMessageEvent.message;

    handleMessage(retrievedMessage).then((errorOrNotification) => {
      if (errorOrNotification.isRight) {
        // tslint:disable-next-line:no-object-mutation
        context.bindings.emailNotification = errorOrNotification.right;
      } else {
        switch (errorOrNotification.left) {
          case ProcessingErrors.NO_PROFILE:
            context.log.error(`Fiscal code has no associated profile|${retrievedMessage.fiscalCode}`);
            context.done();
          case ProcessingErrors.NO_EMAIL:
            context.log.error(`Profile has no associated email|${retrievedMessage.fiscalCode}`);
            context.done();
          case ProcessingErrors.TRANSIENT:
            context.log.error(`Transient error, retrying|${retrievedMessage.fiscalCode}`);
            context.done("Transient error");
        }
      }
    },
    (error) => {
      context.log.error(`Error while processing event, retrying|${retrievedMessage.fiscalCode}|${error}`);
      // in case of error, we return a failure to trigger a retry (up to the configured max retries)
      // TODO: schedule next retry with exponential backoff, see #150597257
      context.done(error);
    });
  } else {
    context.log.error(`Fatal! No valid message found in bindings.`);
    // we will never be able to recover from this, so don't trigger an error
    // TODO: perhaps forward this message to a failed events queue for review
    context.done();
  }
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
