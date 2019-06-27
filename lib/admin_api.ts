/**
 * Main entrypoint for the Administration APIs handlers
 */
import { getRequiredStringEnv } from "./utils/env";

import { Context } from "@azure/functions";

import * as winston from "winston";

import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "io-functions-commons/dist/src/utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { ServiceModel } from "io-functions-commons/dist/src/models/service";

import {
  CreateService,
  GetService,
  UpdateService
} from "./controllers/adm/services";

import { GetDebug } from "./controllers/debug";

import * as express from "express";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup Express
const app = express();
secureExpressApp(app);

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const servicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "services"
);

const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
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
export function index(context: Context): void {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  setAppContext(app, context);
  azureFunctionHandler(context);
}
