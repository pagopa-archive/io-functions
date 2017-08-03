/**
 * Main entrypoint for the public APIs handlers
 */

import { createAzureFunctionHandler } from "azure-function-express";
import * as express from "express";

const app = express();

import * as mongoose from "mongoose";
import { IUser } from "./interfaces/user";
import { IUserModel } from "./models/user";
import { userSchema } from "./schemas/user";

const MONGODB_CONNECTION: string = process.env.CUSTOMCONNSTR_mongo;
const connection: mongoose.Connection = mongoose.createConnection(
  MONGODB_CONNECTION,
  {
    config: {
      autoIndex: false, // do not autoIndex on connect, see http://mongoosejs.com/docs/guide.html#autoIndex
    },
  },
);
const User = connection.model<IUserModel>("User", userSchema);

import debugHandler from "./debugHandler";
app.get("/api/v1/debug", debugHandler);

import { getUserHandler, updateUserHandler } from "./usersApi";
app.get("/api/v1/users/:fiscalcode", getUserHandler);
app.post("/api/v1/users/:fiscalcode", updateUserHandler);

// Binds the express app to an Azure Function handler
module.exports = createAzureFunctionHandler(app);
