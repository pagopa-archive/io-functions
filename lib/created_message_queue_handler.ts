/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";
import * as NodeMailer from "nodemailer";
import * as sparkPostTransport from "nodemailer-sparkpost-transport";

import * as documentDbUtils from "./utils/documentdb";

import { ICreatedMessageEvent, isICreatedMessageEvent } from "./models/created_message_event";
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
// setup NodeMailer
//

const SPARKPOST_KEY: string = process.env.CUSTOMCONNSTR_SPARKPOST_KEY;

const mailerTransporter = NodeMailer.createTransport(sparkPostTransport({
  options: {
    sandbox: true,
  },
  sparkPostApiKey: SPARKPOST_KEY,
}));

//
// Main function
//

interface IContextWithBindings extends IContext {
  bindings: {
    createdMessage?: ICreatedMessageEvent;
  };
}

export function index(context: IContextWithBindings) {
  if (context.bindings.createdMessage != null && isICreatedMessageEvent(context.bindings.createdMessage)) {
    const createdMessageEvent = context.bindings.createdMessage;
    context.log(`Dequeued message|${createdMessageEvent.message.fiscalCode}`);

    const retrievedMessage = createdMessageEvent.message;
    const profilePromise = profileModel.findOneProfileByFiscalCode(retrievedMessage.fiscalCode);

    profilePromise.then(
      (retrievedProfile) => {
        if (retrievedProfile != null) {
          // TODO: emit to all channels
          context.log.verbose(`Sending email|${retrievedProfile.email}|${retrievedMessage.bodyShort}`);
          if (retrievedProfile.email != null) {
            mailerTransporter.sendMail({
              from: "sandbox@sparkpostbox.com",
              html: retrievedMessage.bodyShort,
              subject: "Very important stuff",
              text: retrievedMessage.bodyShort,
              to: retrievedProfile.email,
            }, (err, info) => {
              if (err) {
                context.log.error(`Error sending email|${err}`);
                context.done(err);
              } else {
                context.log.verbose(`Email sent|${info}`);
                context.done();
              }
            });
          } else {
            context.log.warn(
              `Profile is missing email address|${retrievedMessage.fiscalCode}`,
            );
            context.done();
          }
        } else {
          context.log.warn(`Message or profile not found|${retrievedMessage.fiscalCode}`);
          context.done();
        }
      },
      (error) => {
        context.log.error(`Error while querying profile, retrying|${retrievedMessage.fiscalCode}|${error}`);
        // in case of error, fail to trigger a retry
        context.done(error);
      },
    );
  } else {
    context.log.error(`Fatal! No valid message found in bindings.`);
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
