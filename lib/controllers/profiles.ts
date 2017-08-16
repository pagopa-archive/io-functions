import * as express from "express";

import { FiscalCode } from "../../lib/utils/fiscalcode";
import { withValidFiscalCode } from "../../lib/utils/request_validators";

import { handleErrorAndRespond } from "../../lib/utils/error_handler";

import { INewProfile, ProfileModel } from "../models/profile";

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 *
 * TODO only return public visible attributes
 */
export function GetProfile(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((_: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    Profile.findOneProfileByFiscalCode(fiscalCode).then((result) => {
      if (result != null) {
        response.json(result);
      } else {
        response.status(404).send("Not found");
      }
    }, handleErrorAndRespond(response));
  });
}

/**
 * Returns an updateProfile controller
 *
 * @param Profile The Profile model.
 *
 * TODO: only return public visible attributes
 */
export function UpdateProfile(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    const profile: INewProfile = {
      email: request.body.email,
      fiscalCode,
      id: fiscalCode,
    };
    Profile.createOrUpdateProfile(profile).then((result) => {
      if (result != null) {
        response.json(result);
      } else {
        response.status(500).send("Did not create");
      }
    }, handleErrorAndRespond(response));
  });
}
