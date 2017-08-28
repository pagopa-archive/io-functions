/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { ICreatedMessageEvent, isICreatedMessageEvent } from "./models/created_message_event";
import { IEmailNotificationEvent } from "./models/email_notification_event";
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

/**
 * Input and output bindings for this function
 * see CreatedMessageQueueHandler/function.json
 */
interface IContextWithBindings extends IContext {
  bindings: {
    createdMessage?: ICreatedMessageEvent;
    emailNotification?: IEmailNotificationEvent;
  };
}

/**
 * Function handler
 */
export function index(context: IContextWithBindings) {
  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  if (context.bindings.createdMessage != null && isICreatedMessageEvent(context.bindings.createdMessage)) {
    // it is an ICreatedMessageEvent
    const createdMessageEvent = context.bindings.createdMessage;
    context.log(`Dequeued message|${createdMessageEvent.message.fiscalCode}`);

    const retrievedMessage = createdMessageEvent.message;

    // async fetch of profile data associated to the fiscal code the message
    // should be delivered to
    const profilePromise = profileModel.findOneProfileByFiscalCode(retrievedMessage.fiscalCode);

    profilePromise.then(
      (retrievedProfile) => {
        if (retrievedProfile != null) {
          // we got a valid profile associated to the message, we can trigger
          // notifications on the configured channels.
          // TODO: emit to all channels (push notification, sms, etc...)

          // in case an email address is configured in the profile, we can
          // trigger an email notification event
          context.log.verbose(`Queing email notification|${retrievedProfile.email}|${retrievedMessage.bodyShort}`);
          if (retrievedProfile.email != null) {
            context.bindings.emailNotification = {
              message: retrievedMessage,
              recipients: [ retrievedProfile.email ],
            };
          } else {
            context.log.warn(
              `Profile is missing email address|${retrievedMessage.fiscalCode}`,
            );
          }

          // we're done triggering the notifications
          context.done();
        } else {
          // TODO: how do we handle this?
          context.log.warn(`Profile not found|${retrievedMessage.fiscalCode}`);
          context.done();
        }
      },
      (error) => {
        context.log.error(`Error while querying profile, retrying|${retrievedMessage.fiscalCode}|${error}`);
        // in case of error, we return a failure to trigger a retry (up to the configured max retries)
        // TODO: schedule next retry with exponential backoff, see #150597257
        context.done(error);
      },
    );
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
