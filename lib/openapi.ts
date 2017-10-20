/**
 * Entrypoint for the Openapi handler
 */

import { IContext } from "azure-function-express";

import * as express from "express";
import * as winston from "winston";

import { setAppContext } from "./utils/middlewares/context_middleware";

import { configureAzureContextTransport } from "./utils/logging";

import { createAzureFunctionHandler } from "azure-function-express";

import { GetOpenapi } from "./controllers/openapi";

import { specs as publicApiV1Specs } from "./api/public_api_v1";

// Setup Express

const app = express();

app.get("/api/v1/swagger.json", GetOpenapi(publicApiV1Specs));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
export function index(context: IContext<{}>): void {
  configureAzureContextTransport(context, winston, "debug");
  setAppContext(app, context);
  azureFunctionHandler(context);
}
