import * as express from "express";

import { FiscalCode } from "../utils/fiscalcode";
import { withValidFiscalCode } from "../utils/request_validators";

import { IProfile } from "../interfaces/profile";
import { ProfileModel } from "../models/profile";

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 *
 * TODO only return public visible attributes
 */
export function getProfileController(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((_: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    Profile.findOneProfileByFiscalCode(fiscalCode).then((result) => {
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
  });
}

/**
 * Returns an updateProfile controller
 *
 * @param Profile The Profile model.
 *
 * TODO only return public visible attributes
 */
export function updateProfileController(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    const profile: IProfile = {
      email: request.body.email,
      fiscalCode,
    };
    Profile.createOrUpdateProfile(profile).then((result) => {
      if (result != null) {
        response.json(result);
      } else {
        response.status(500).send("Did not create");
      }
    },
    (error) => {
      response.status(500).json({
        error,
      });
    });
  });
}
