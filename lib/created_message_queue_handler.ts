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

import { ICreatedMessageEvent } from "./models/created_message_event";
import { MessageModel } from "./models/message";
import { ProfileModel } from "./models/profile";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

// TODO: read from env vars
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl("development");
const messagesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "messages");
const profilesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "profiles");

const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });

const messageModel = new MessageModel(documentClient, messagesCollectionUrl);
const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);

//
// setup NodeMailer
//

const SPARKPOST_KEY: string = process.env.CUSTOMCONNSTR_SPARKPOST_KEY;

const mailerTransporter = NodeMailer.createTransport(sparkPostTransport({
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
  if (context.bindings.createdMessage != null) {
    const message: ICreatedMessageEvent = context.bindings.createdMessage;
    if (message.messageId != null && message.fiscalCode != null) {
      context.log(`Dequeued message [${message.messageId}].`);

      const messagePromise = messageModel.findMessage(message.fiscalCode, message.messageId);
      const profilePromise = profileModel.findOneProfileByFiscalCode(message.fiscalCode);

      Promise.all([profilePromise, messagePromise]).then(
        ([retrievedProfile, retrievedMessage]) => {
          if (retrievedProfile != null && retrievedMessage != null) {
            // TODO: emit to all channels
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
              context.log.warn(`Profile is missing email address|${message.messageId}|${message.fiscalCode}`);
              context.done();
            }
          } else {
            context.log.warn(`Message or profile not found|${message.messageId}|${message.fiscalCode}`);
            context.done();
          }
        },
        (error) => {
          context.log.error(`Error while querying message, retrying|${message.messageId}|${error}`);
          // in case of error, fail to trigger a retry
          context.done(error);
        },
      );
    } else {
      context.log.error(`Fatal! Message ID is null.`);
      context.done();
    }
  } else {
    context.log.error(`Fatal! No message found in bindings.`);
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
