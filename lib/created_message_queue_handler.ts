/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import { IContext } from "./azure-functions-types";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { ICreatedMessageEvent } from "./models/created_message_event";
import { MessageModel } from "./models/message";

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl("development");
const messagesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "messages");

const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });

const messageModel = new MessageModel(documentClient, messagesCollectionUrl);

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
      messageModel.findMessage(message.fiscalCode, message.messageId).then(
        (storedMessage) => {
          if (storedMessage != null) {
            context.log(`Message [${message.messageId}] recipient is [${storedMessage.fiscalCode}].`);
          } else {
            context.log(`Message [${message.messageId}] not found.`);
          }
          context.done();
        },
        (error) => {
          context.log(`Error while querying message [${message.messageId}].`);
          // in case of error, fail to trigger a retry
          context.done(error);
        },
      );
    } else {
      context.log(`Fatal! Message ID is null.`);
      context.done();
    }
  } else {
    context.log(`Fatal! No message found in bindings.`);
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
