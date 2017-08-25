import * as express from "express";

import { FiscalCode } from "../../lib/utils/fiscalcode";
import { withValidFiscalCode } from "../../lib/utils/request_validators";

import { handleErrorAndRespond, handleNullableResultAndRespond } from "../../lib/utils/error_handler";

import { IProfile, ProfileModel } from "../models/profile";

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 *
 * TODO only return public visible attributes
 */
export function GetProfile(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((_: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    return Profile.findOneProfileByFiscalCode(fiscalCode).then(
      handleNullableResultAndRespond(response, 404, "Not found"),
      handleErrorAndRespond(response),
    );
  });
}

/**
 * Returns an UpsertProfile controller.
 *
 * This controller will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 *
 * @param Profile The Profile model.
 *
 * TODO: only return public visible attributes
 * TODO: validate incoming object
 */
export function UpsertProfile(Profile: ProfileModel): express.RequestHandler {
  return withValidFiscalCode((request: express.Request, response: express.Response, fiscalCode: FiscalCode) => {
    const existingProfilePromise = Profile.findOneProfileByFiscalCode(fiscalCode);
    existingProfilePromise.then((queryProfileResult) => {
      if (queryProfileResult == null) {
        // create a new profile
        const profile: IProfile = {
          email: typeof request.body.email === "string" ? request.body.email : null,
          fiscalCode,
        };
        Profile.createProfile(profile).then(
          handleNullableResultAndRespond(response, 500, "Error while creating a new profile"),
          handleErrorAndRespond(response),
        );
      } else {
        // update existing profile
        const profile = {
          ...queryProfileResult,
          email: typeof request.body.email === "string" ? request.body.email : queryProfileResult.email,
        };
        Profile.updateProfile(profile).then(
          handleNullableResultAndRespond(response, 500, "Error while updating the profile"),
          handleErrorAndRespond(response),
        );
      }
    }, handleErrorAndRespond(response));

  });
}
