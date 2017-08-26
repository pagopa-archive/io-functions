import * as express from "express";

import { FiscalCodeMiddleware } from "../../lib/utils/fiscalcode_middleware";
import { IRequestMiddleware, withRequestMiddlewares } from "../../lib/utils/request_middleware";

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
  return withRequestMiddlewares(FiscalCodeMiddleware)((response, fiscalCode) => {
    return Profile.findOneProfileByFiscalCode(fiscalCode).then(
      handleNullableResultAndRespond(response, 404, "Not found"),
      handleErrorAndRespond(response),
    );
  });
}

interface IProfilePayload {
  email?: string;
}

/**
 * A middleware that extracts a Profile payload from a request.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<IProfilePayload> =
  (request, _) => {
    return Promise.resolve({
      email: typeof request.body.email === "string" ? request.body.email : undefined,
    });
  };

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
  return withRequestMiddlewares(FiscalCodeMiddleware, ProfilePayloadMiddleware)(
    (response, fiscalCode, profileModelPayload) => {
    const existingProfilePromise = Profile.findOneProfileByFiscalCode(fiscalCode);
    existingProfilePromise.then((queryProfileResult) => {
      if (queryProfileResult == null) {
        // create a new profile
        const profile: IProfile = {
          email: profileModelPayload.email,
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
          email: profileModelPayload.email,
        };
        Profile.updateProfile(profile).then(
          handleNullableResultAndRespond(response, 500, "Error while updating the profile"),
          handleErrorAndRespond(response),
        );
      }
    }, handleErrorAndRespond(response));

  });
}
