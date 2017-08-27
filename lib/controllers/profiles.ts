import * as express from "express";

import { right } from "../utils/either";

import { FiscalCodeMiddleware } from "../../lib/utils/fiscalcode_middleware";
import { FiscalCode } from "../utils/fiscalcode";
import { IRequestMiddleware, withRequestMiddlewares, wrapRequestHandler } from "../utils/request_middleware";

import { handleNullableResultAndRespond } from "../../lib/utils/error_handler";

import {
  IResponseErrorGeneric,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson,
} from "../utils/response";

import { IProfile, IRetrievedProfile, ProfileModel } from "../models/profile";

type IGetProfileHandler = (fiscalCode: FiscalCode) => Promise<
  IResponseSuccessJson<IRetrievedProfile> |
  IResponseErrorNotFound
>;

export function GetProfileHandler(Profile: ProfileModel): IGetProfileHandler {
  return (fiscalCode) => new Promise((resolve, reject) => {
    Profile.findOneProfileByFiscalCode(fiscalCode).then(
      (profile) => {
        if (profile !== null) {
          resolve(ResponseSuccessJson(profile));
        } else {
          resolve(ResponseErrorNotFound("Profile not found"));
        }
      },
      reject,
    );
  });
}

/**
 * Returns a getProfile handler
 *
 * @param Profile The Profile model.
 *
 * TODO: only return public visible attributes
 */
export function GetProfile(
  handler: IGetProfileHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}

interface IProfilePayload {
  email?: string;
}

/**
 * A middleware that extracts a Profile payload from a request.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<never, IProfilePayload> =
  (request) => {
    return Promise.resolve(right({
      email: typeof request.body.email === "string" ? request.body.email : undefined,
    }));
  };

type IUpsertProfileHandler = (
  fiscalCode: FiscalCode,
  profileModelPayload: IProfilePayload,
) => Promise<
  IResponseSuccessJson<IRetrievedProfile> |
  IResponseErrorValidation |
  IResponseErrorGeneric
>;

export function UpsertProfileHandler(Profile: ProfileModel): IUpsertProfileHandler {
  return (fiscalCode, profileModelPayload) => new Promise((resolve, reject) => {
    const existingProfilePromise = Profile.findOneProfileByFiscalCode(fiscalCode);
    existingProfilePromise.then((queryProfileResult) => {
      if (queryProfileResult == null) {
        // create a new profile
        const profile: IProfile = {
          email: profileModelPayload.email,
          fiscalCode,
        };
        Profile.createProfile(profile).then(
          handleNullableResultAndRespond(resolve, "Error while creating a new profile"),
          reject,
        );
      } else {
        // update existing profile
        const profile = {
          ...queryProfileResult,
          email: profileModelPayload.email,
        };
        Profile.updateProfile(profile).then(
          handleNullableResultAndRespond(resolve, "Error while updating the profile"),
          reject,
        );
      }
    });
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
export function UpsertProfile(
  handler: IUpsertProfileHandler,
): express.RequestHandler {
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
