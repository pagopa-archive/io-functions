import * as express from "express";

import { isFiscalCode } from "./utils/fiscalcode";

import { ProfileModel } from "./models/profile";

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 *
 * TODO only return public visible preferences
 */
export function getProfileHandler(Profile: ProfileModel): express.RequestHandler {
  return (request: express.Request, response: express.Response) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      Profile.getProfileByFiscalCode(fiscalCode).then((result) => {
        if (result != null) {
          response.json(result);
        } else {
          response.status(404).send("Not found");
        }
      },
      (error) => {
        response.status(500).json({
          error,
        });
      });
    } else {
      response.status(404).send("Not found");
    }
  };
}

/**
 * Returns an updateProfile handler
 *
 * @param Profile The Profile model.
 */
export function updateProfileHandler(Profile: ProfileModel): express.RequestHandler {
  return (request: express.Request, response: express.Response) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      Profile.getProfileByFiscalCode(fiscalCode).then((result) => {
        if (result != null) {
          response.json(result);
        } else {
          response.status(404).send("Not found");
        }
      },
      (error) => {
        response.status(500).json({
          error,
        });
      });
    } else {
      response.status(404).send("Not found");
    }
  };
}
