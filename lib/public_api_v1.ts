/**
 * Main entrypoint for the public APIs handlers
 */

import { IContext } from "azure-function-express";

import * as winston from "winston";

import * as ApplicationInsights from "applicationinsights";

import { setAppContext } from "./utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express";

import { MessageModel } from "./models/message";
import { NotificationModel } from "./models/notification";
import { ProfileModel } from "./models/profile";
import { ServiceModel } from "./models/service";

import { GetDebug } from "./controllers/debug";
import { GetInfo } from "./controllers/info";
import { CreateMessage, GetMessage, GetMessages } from "./controllers/messages";
import { GetProfile, UpsertProfile } from "./controllers/profiles";
import { toNonEmptyString } from "./utils/strings";

import * as express from "express";
import { secureExpressApp } from "./utils/express";

// Setup Express
const app = express();
secureExpressApp(app);

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const MESSAGE_CONTAINER_NAME: string = process.env.MESSAGE_CONTAINER_NAME;

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(
  process.env.COSMOSDB_NAME
);
const messagesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "messages"
);
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "profiles"
);
const servicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "services"
);
const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "notifications"
);

const documentClient = new DocumentDBClient(COSMOSDB_URI, {
  masterKey: COSMOSDB_KEY
});

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
const messageModel = new MessageModel(
  documentClient,
  messagesCollectionUrl,
  toNonEmptyString(MESSAGE_CONTAINER_NAME).get
);
const serviceModel = new ServiceModel(documentClient, servicesCollectionUrl);
const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

// Setup ApplicationInsights

const appInsightsClient = new ApplicationInsights.TelemetryClient();

// Setup handlers

const debugHandler = GetDebug(serviceModel);
app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/profiles/:fiscalcode", GetProfile(profileModel));
app.post("/api/v1/profiles/:fiscalcode", UpsertProfile(profileModel));

app.get(
  "/api/v1/messages/:fiscalcode/:id",
  GetMessage(serviceModel, messageModel, notificationModel)
);
app.get("/api/v1/messages/:fiscalcode", GetMessages(messageModel));
app.post(
  "/api/v1/messages/:fiscalcode",
  CreateMessage(appInsightsClient, serviceModel, messageModel)
);

app.get("/api/v1/info", GetInfo());

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: IContext<{}>): void {
  configureAzureContextTransport(context, winston, "debug");
  setAppContext(app, context);
  azureFunctionHandler(context);
}
