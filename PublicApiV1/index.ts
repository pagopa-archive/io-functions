/**
 * Main entrypoint for the public APIs handlers
 */

import * as azure from "azure-storage";
import * as express from "express";
import * as mongoose from "mongoose";

import { createAzureFunctionHandler } from "azure-function-express";

import { IMessageModel, MessageModel } from "./models/message";
import { IProfileModel, ProfileModel } from "./models/profile";
import { messageSchema } from "./schemas/message";
import { profileSchema } from "./schemas/profile";

import debugHandler from "./controllers/debug";
import { CreateMessage, GetMessage, GetMessages } from "./controllers/messages";
import { GetProfile, UpdateProfile } from "./controllers/profiles";

// Setup Express

const app = express();

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

const profileModel = new ProfileModel(connection.model<IProfileModel>("Profile", profileSchema));
const messageModel = new MessageModel(connection.model<IMessageModel>("Message", messageSchema));

// Setup queues

const CREATED_MESSAGES_QUEUE_CONNECTION: string = process.env.APPSETTING_QueueStorageConnection;
const CREATED_MESSAGES_QUEUE_NAME = "createdmessages";

const queueService = azure.createQueueService(CREATED_MESSAGES_QUEUE_CONNECTION);

// Setup handlers

app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/profiles/:fiscalcode", GetProfile(profileModel));
app.post("/api/v1/profiles/:fiscalcode", UpdateProfile(profileModel));

app.get("/api/v1/messages/:fiscalcode/:id", GetMessage(messageModel));
app.get("/api/v1/messages/:fiscalcode", GetMessages(messageModel));
app.post("/api/v1/messages/:fiscalcode", CreateMessage(messageModel, queueService, CREATED_MESSAGES_QUEUE_NAME));

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
