/**
 * Main entrypoint for the public APIs handlers
 */

import { IContext } from "azure-function-express";

import * as express from "express";
import * as winston from "winston";

import * as ApplicationInsights from "applicationinsights";

import { setAppContext } from "./utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express";

import { MessageModel } from "./models/message";
import { NotificationModel } from "./models/notification";
import { OrganizationModel } from "./models/organization";
import { ProfileModel } from "./models/profile";

import { GetDebug } from "./controllers/debug";
import { GetInfo } from "./controllers/info";
import { CreateMessage, GetMessage, GetMessages } from "./controllers/messages";
import { GetProfile, UpsertProfile } from "./controllers/profiles";
import { toNonEmptyString } from "./utils/strings";

import * as helmet from "helmet";
import * as csp from "helmet-csp";
import * as referrerPolicy from "referrer-policy";

// Setup Express
const app = express();

// Set header `referrer-policy` to `no-referrer`
app.use(referrerPolicy());

// Set up Content Security Policy
app.use(
  csp({
    directives: {
      defaultSrc: ["'none'"],
      upgradeInsecureRequests: true
    }
  })
);

// Set up the following HTTP headers
// (see https://helmetjs.github.io/ for default values)
//    strict-transport-security: max-age=15552000; includeSubDomains
//    transfer-encoding: chunked
//    x-content-type-options: nosniff
//    x-dns-prefetch-control: off
//    x-download-options: noopen
//    x-frame-options: DENY
//    x-xss-protection →1; mode=block
app.use(
  helmet({
    frameguard: {
      action: "deny"
    }
  })
);

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const MESSAGE_CONTAINER_NAME: string = process.env.MESSAGE_CONTAINER_NAME;

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri("development");
const messagesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "messages"
);
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "profiles"
);
const organizationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "organizations"
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
const organizationModel = new OrganizationModel(
  documentClient,
  organizationsCollectionUrl
);
const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

// Setup ApplicationInsights

const appInsightsClient = new ApplicationInsights.TelemetryClient();

// Setup handlers

const debugHandler = GetDebug(organizationModel);
app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/profiles/:fiscalcode", GetProfile(profileModel));
app.post("/api/v1/profiles/:fiscalcode", UpsertProfile(profileModel));

app.get(
  "/api/v1/messages/:fiscalcode/:id",
  GetMessage(organizationModel, messageModel, notificationModel)
);
app.get("/api/v1/messages/:fiscalcode", GetMessages(messageModel));
app.post(
  "/api/v1/messages/:fiscalcode",
  CreateMessage(appInsightsClient, organizationModel, messageModel)
);

app.get("/api/v1/info", GetInfo());

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: IContext<{}>): void {
  configureAzureContextTransport(context, winston, "debug");
  setAppContext(app, context);
  azureFunctionHandler(context);
}
