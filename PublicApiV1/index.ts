/**
 * Main entrypoint for the public APIs handlers
 */

import { createAzureFunctionHandler } from "azure-function-express";
import * as express from "express";

const app = express();

import debugHandler from "./debugHandler";
app.get("/api/v1/debug", debugHandler);

// app.get("/api/v1/users/:fiscalcode", getUserHandler);

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
