/**
 * Main entrypoint for the public APIs handlers
 */

import { createAzureFunctionHandler } from "azure-function-express";
import * as express from "express";

const app = express();

import * as mongoose from "mongoose";
import { IProfileModel, ProfileModel } from "./models/profile";
import { profileSchema } from "./schemas/profile";

import debugHandler from "./controllers/debugController";
import { getProfileController, updateProfileController } from "./controllers/profilesController";

// Use native promises
( mongoose as any ).Promise = global.Promise;

const MONGODB_CONNECTION: string = process.env.CUSTOMCONNSTR_development;
const connection: mongoose.Connection = mongoose.createConnection(
  MONGODB_CONNECTION,
  {
    config: {
      autoIndex: false, // do not autoIndex on connect, see http://mongoosejs.com/docs/guide.html#autoIndex
    },
  },
);

const profileModel = new ProfileModel(connection.model<IProfileModel>("Profile", profileSchema));

app.get("/api/v1/debug", debugHandler);
app.post("/api/v1/debug", debugHandler);

app.get("/api/v1/profiles/:fiscalcode", getProfileController(profileModel));
app.post("/api/v1/profiles/:fiscalcode", updateProfileController(profileModel));

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
