/**
 * Main entrypoint for the Administration APIs handlers
 */
import { IContext } from "azure-function-express";

import * as winston from "winston";

import { setAppContext } from "./utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { createAzureFunctionHandler } from "azure-function-express";

import { ServiceModel } from "./models/service";

import {
  CreateService,
  GetService,
  UpdateService
} from "./controllers/adm/services";

import { GetDebug } from "./controllers/debug";

import * as express from "express";
import { secureExpressApp } from "./utils/express";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup Express
const app = express();
secureExpressApp(app);

// Setup DocumentDB

const COSMOSDB_URI: string = process.env.CUSTOMCONNSTR_COSMOSDB_URI;
const COSMOSDB_KEY: string = process.env.CUSTOMCONNSTR_COSMOSDB_KEY;

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(
  process.env.COSMOSDB_NAME
);

const servicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "services"
);

const documentClient = new DocumentDBClient(COSMOSDB_URI, {
  masterKey: COSMOSDB_KEY
});

const serviceModel = new ServiceModel(documentClient, servicesCollectionUrl);

// Setup handlers

const debugHandler = GetDebug(serviceModel);
app.get("/adm/debug", debugHandler);
app.post("/adm/debug", debugHandler);

app.get("/adm/services/:serviceid", GetService(serviceModel));
app.post("/adm/services", CreateService(serviceModel));
app.put("/adm/services/:serviceid", UpdateService(serviceModel));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: IContext<{}>): void {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  setAppContext(app, context);
  azureFunctionHandler(context);
}
