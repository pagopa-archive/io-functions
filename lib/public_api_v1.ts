/**
 * Main entrypoint for the public APIs handlers
 */

import * as express from "express";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express-cloudify";

import { MessageModel } from "./models/message";
import { ProfileModel } from "./models/profile";

import debugHandler from "./controllers/debug";
import {
  CreateMessage,
  CreateMessageHandler,
  GetMessage,
  GetMessageHandler,
  GetMessages,
  GetMessagesHandler,
} from "./controllers/messages";
import {
  GetProfile,
  GetProfileHandler,
  UpsertProfile,
  UpsertProfileHandler,
} from "./controllers/profiles";

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

// Setup handlers

app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/profiles/:fiscalcode", GetProfile(GetProfileHandler(profileModel)));
app.post("/api/v1/profiles/:fiscalcode", UpsertProfile(UpsertProfileHandler(profileModel)));

app.get("/api/v1/messages/:fiscalcode/:id", GetMessage(GetMessageHandler(messageModel)));
app.get("/api/v1/messages/:fiscalcode", GetMessages(GetMessagesHandler(messageModel)));
app.post("/api/v1/messages/:fiscalcode", CreateMessage(CreateMessageHandler(messageModel)));

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
