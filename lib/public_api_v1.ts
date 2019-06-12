/**
 * Main entrypoint for the public APIs handlers
 */
import { getRequiredStringEnv } from "./utils/env";

import { IContext } from "azure-function-express";

import * as cors from "cors";
import * as winston from "winston";

import { setAppContext } from "./utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express";

import {
  MESSAGE_COLLECTION_NAME,
  MessageModel
} from "io-functions-commons/dist/src/models/message";
import {
  NOTIFICATION_COLLECTION_NAME,
  NotificationModel
} from "io-functions-commons/dist/src/models/notification";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "io-functions-commons/dist/src/models/profile";
import {
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "io-functions-commons/dist/src/models/service";

import { GetDebug } from "./controllers/debug";
import { GetInfo } from "./controllers/info";
import { CreateMessage, GetMessage, GetMessages } from "./controllers/messages";
import { GetProfile, UpsertProfile } from "./controllers/profiles";

import * as express from "express";
import { secureExpressApp } from "./utils/express";

import { createBlobService } from "azure-storage";

import {
  MESSAGE_STATUS_COLLECTION_NAME,
  MessageStatusModel
} from "io-functions-commons/dist/src/models/message_status";
import {
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel
} from "io-functions-commons/dist/src/models/notification_status";
import {
  SENDER_SERVICE_COLLECTION_NAME,
  SenderServiceModel
} from "io-functions-commons/dist/src/models/sender_service";
import {
  GetService,
  GetServicesByRecipient,
  GetVisibleServices
} from "./controllers/services";

import { TelemetryClient } from "applicationinsights";
import { wrapCustomTelemetryClient } from "./utils/application_insights";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

const getCustomTelemetryClient = wrapCustomTelemetryClient(
  isProduction,
  new TelemetryClient()
);

// Setup Express
const app = express();
secureExpressApp(app);

// Set up CORS (free access to the API from browser clients)
app.use(cors());

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");
const messageContainerName = getRequiredStringEnv("MESSAGE_CONTAINER_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const messagesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_COLLECTION_NAME
);
const messageStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  MESSAGE_STATUS_COLLECTION_NAME
);
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  PROFILE_COLLECTION_NAME
);
const servicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  SERVICE_COLLECTION_NAME
);
const senderServicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  SENDER_SERVICE_COLLECTION_NAME
);
const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_COLLECTION_NAME
);
const notificationsStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_STATUS_COLLECTION_NAME
);

const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);
const messageModel = new MessageModel(
  documentClient,
  messagesCollectionUrl,
  messageContainerName
);
const messageStatusModel = new MessageStatusModel(
  documentClient,
  messageStatusCollectionUrl
);

const serviceModel = new ServiceModel(documentClient, servicesCollectionUrl);

const senderServiceModel = new SenderServiceModel(
  documentClient,
  senderServicesCollectionUrl
);

const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

const notificationStatusModel = new NotificationStatusModel(
  documentClient,
  notificationsStatusCollectionUrl
);

const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");
const blobService = createBlobService(storageConnectionString);

// Setup handlers

const debugHandler = GetDebug(serviceModel);
app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/services/:serviceid", GetService(serviceModel));

app.get(
  "/api/v1/profiles/:fiscalcode/sender-services",
  GetServicesByRecipient(serviceModel, senderServiceModel)
);

app.get("/api/v1/services", GetVisibleServices(serviceModel, blobService));

app.get("/api/v1/profiles/:fiscalcode", GetProfile(serviceModel, profileModel));
app.post(
  "/api/v1/profiles/:fiscalcode",
  UpsertProfile(serviceModel, profileModel)
);

app.get(
  "/api/v1/messages/:fiscalcode/:id",
  GetMessage(
    serviceModel,
    messageModel,
    messageStatusModel,
    notificationModel,
    notificationStatusModel,
    blobService
  )
);

app.get(
  "/api/v1/messages/:fiscalcode",
  GetMessages(serviceModel, messageModel)
);
app.post(
  "/api/v1/messages/:fiscalcode",
  CreateMessage(getCustomTelemetryClient, serviceModel, messageModel)
);

app.get("/api/v1/info", GetInfo(serviceModel));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: IContext<{}>): void {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  setAppContext(app, context);
  azureFunctionHandler(context);
}
