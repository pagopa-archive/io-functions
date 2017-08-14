import * as mongoose from "mongoose";

import { IMessageModel, MessageModel } from "../lib/models/message";

import { messageSchema } from "../lib/schemas/message";

// Setup Mongoose

( mongoose as any ).Promise = global.Promise;

const MONGODB_CONNECTION: string = process.env.CUSTOMCONNSTR_development;
const connection: mongoose.Connection = mongoose.createConnection(
  MONGODB_CONNECTION,
  {
    config: {
      autoIndex: false, // do not autoIndex on connect, see http://mongoosejs.com/docs/guide.html#autoIndex
    },
  },
);

const messageModel = new MessageModel(connection.model<IMessageModel>("Message", messageSchema));

interface IContext {
  bindingData: {
    queueTrigger?: string;
    expirationTime?: Date;
    insertionTime?: Date;
    nextVisibleTime?: Date;
    id: string;
    popReceipt: string;
    dequeueCount: number;
  };
  log: (msg: any, params?: any) => any;
  done: () => void;
}

interface IContextWithBindings extends IContext {
  bindings: {
    createdMessage?: IMessagePayload;
  };
}

interface IMessagePayload {
  messageId?: string;
}

export function index(context: IContextWithBindings) {
  if (context.bindings.createdMessage != null) {
    const message: IMessagePayload = context.bindings.createdMessage;
    if (message.messageId != null) {
      context.log(`Dequeued message [${message.messageId}]`);
      messageModel.findMessage(message.messageId).then((storedMessage) => {
        if (storedMessage != null) {
          context.log(`Message [${message.messageId}] recipient is [${storedMessage.fiscalCode}].`);
        } else {
          context.log(`Message [${message.messageId}] not found.`);
        }
        context.done();
      },
      (error) => {
        // in case of error, fail to trigger a retry
        throw(error);
      });
    } else {
      context.log(`Message ID is null`);
    }
  } else {
    context.log(`Fatal! no message found in bindings.`);
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
