import * as express from "express";
import * as mongoose from "mongoose";

import { IUserModel } from "./models/user";

export function getUserHandler(User: mongoose.Model<IUserModel>): express.RequestHandler {
  return (req: express.Request, res: express.Response) => {
    res.json({
      OK: true,
      fiscal_code: req.params.fiscalcode,
    });
  };
}

export function updateUserHandler(User: mongoose.Model<IUserModel>): express.RequestHandler {
  return (req: express.Request, res: express.Response) => {
    res.json({
      OK: true,
      fiscal_code: req.params.fiscalcode,
    });
  };
}
