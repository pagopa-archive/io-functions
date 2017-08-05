import * as express from "express";

import { isFiscalCode } from "./utils/fiscalcode";

import { ProfileModel } from "./models/profile";

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 */
export function getProfileHandler(Profile: ProfileModel): express.RequestHandler {
  return (request: express.Request, response: express.Response) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      Profile.getProfileByFiscalCode(fiscalCode).then((result) => {
        response.json(result);
      },
      (error) => {
        response.json({
          error,
        });
      });
    } else {
      response.json({
        error: "not a fiscal code",
      });
    }
  };
}

/**
 * Returns an updateProfile handler
 *
 * @param Profile The Profile model.
 */
/*
export function updateProfileHandler(Profile: ProfileModel): express.RequestHandler {
  return (req: express.Request, res: express.Response) => {
    res.json({
      OK: true,
      fiscal_code: req.params.fiscalcode,
    });
  };
}
*/
