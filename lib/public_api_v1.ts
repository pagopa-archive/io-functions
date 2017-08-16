/**
 * Main entrypoint for the public APIs handlers
 */

import * as azure from "azure-storage";
import * as express from "express";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express";

import { MessageModel } from "./models/message";
import { ProfileModel } from "./models/profile";

import debugHandler from "./controllers/debug";
import { CreateMessage, GetMessage, GetMessages } from "./controllers/messages";
import { GetProfile, UpdateProfile } from "./controllers/profiles";

// Setup Express

const app = express();

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUrl("development");
const messagesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "messages");
const profilesCollectionUrl = documentDbUtils.getCollectionUrl(documentDbDatabaseUrl, "profiles");

const documentClient = new DocumentDBClient(COSMOSDB_URI, { masterKey: COSMOSDB_KEY });

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
const messageModel = new MessageModel(documentClient, messagesCollectionUrl);

// Setup queues

const CREATED_MESSAGES_QUEUE_CONNECTION: string = process.env.APPSETTING_QueueStorageConnection;
const CREATED_MESSAGES_QUEUE_NAME = "createdmessages";

const queueService = azure.createQueueService(CREATED_MESSAGES_QUEUE_CONNECTION);
// encode messages in base64 to make them readable by consuming functions
// see https://github.com/Azure/azure-storage-node/issues/176
queueService.messageEncoder = new azure.QueueMessageEncoder.TextBase64QueueMessageEncoder();

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
