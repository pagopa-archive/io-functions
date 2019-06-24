/**
 * Entrypoint for the Openapi handler
 */

import { Context } from "@azure/functions";

import * as express from "express";
import * as winston from "winston";

import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { GetOpenapi } from "./controllers/openapi";

import { specs as adminApiSpecs } from "./api/admin_api";
import { specs as publicApiV1Specs } from "./api/public_api_v1";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup Express

const app = express();

app.get("/specs/api/v1/swagger.json", GetOpenapi(publicApiV1Specs));
app.get("/specs/adm/swagger.json", GetOpenapi(adminApiSpecs));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: Context): void {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  setAppContext(app, context);
  azureFunctionHandler(context);
}
