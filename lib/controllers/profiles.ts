/*
 * Implements the API handlers for the Profile resource.
 */

import * as express from "express";

import { right } from "../utils/either";

import { FiscalCode } from "../utils/fiscalcode";
import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup,
} from "../utils/middlewares/azure_api_auth";
import { FiscalCodeMiddleware } from "../utils/middlewares/fiscalcode";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler,
} from "../utils/request_middleware";

import { handleNullableResultAndRespond } from "../../lib/utils/error_handler";

import {
  IResponseErrorGeneric,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson,
} from "../utils/response";

import {
  asPublicExtendedProfile,
  asPublicLimitedProfile,
  IProfile,
  IPublicExtendedProfile,
  IPublicLimitedProfile,
  ProfileModel,
} from "../models/profile";

/**
 * Type of a GetProfile handler.
 *
 * GetProfile expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetProfileHandler = (
  auth: IAzureApiAuthorization,
  fiscalCode: FiscalCode,
) => Promise<
  IResponseSuccessJson<IPublicLimitedProfile> |
  IResponseSuccessJson<IPublicExtendedProfile> |
  IResponseErrorNotFound
>;

/**
 * Type of an UpsertProfile handler.
 *
 * UpsertProfile expects a FiscalCode and a Profile as input and
 * returns a Profile or a Validation or a Generic error.
 */
type IUpsertProfileHandler = (
  auth: IAzureApiAuthorization,
  fiscalCode: FiscalCode,
  profileModelPayload: IProfilePayload,
) => Promise<
  IResponseSuccessJson<IPublicExtendedProfile> |
  IResponseErrorValidation |
  IResponseErrorGeneric
>;

/**
 * Return a type safe GetProfile handler.
 *
 * TODO: return extended profile if client is trusted
 */
export function GetProfileHandler(profileModel: ProfileModel): IGetProfileHandler {
  return (_, fiscalCode) => new Promise((resolve, reject) => {
    profileModel.findOneProfileByFiscalCode(fiscalCode).then(
      (profile) => {
        if (profile !== null) {
          const publicProfile = asPublicLimitedProfile(profile);
          resolve(ResponseSuccessJson(publicProfile));
        } else {
          resolve(ResponseErrorNotFound("Profile not found"));
        }
      },
      reject,
    );
  });
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
export function GetProfile(
  profileModel: ProfileModel,
): express.RequestHandler {
  const handler = GetProfileHandler(profileModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.Developers])),
    FiscalCodeMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * A new profile payload.
 *
 * TODO: generate from a schema.
 */
interface IProfilePayload {
  email?: string;
}

/**
 * A middleware that extracts a Profile payload from a request.
 *
 * TODO: validate the payload against a schema.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<never, IProfilePayload> =
  (request) => {
    return Promise.resolve(right({
      email: typeof request.body.email === "string" ? request.body.email : undefined,
    }));
  };

/**
 * This handler will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 */
export function UpsertProfileHandler(profileModel: ProfileModel): IUpsertProfileHandler {
  return (_, fiscalCode, profileModelPayload) => new Promise((resolve, reject) => {
    const existingProfilePromise = profileModel.findOneProfileByFiscalCode(fiscalCode);
    existingProfilePromise.then((queryProfileResult) => {
      if (queryProfileResult == null) {
        // create a new profile
        const profile: IProfile = {
          email: profileModelPayload.email,
          fiscalCode,
        };
        profileModel.createProfile(profile).then(
          (p) => p !== null ? asPublicExtendedProfile(p) : null,
          reject,
        ).then(
          handleNullableResultAndRespond(resolve, "Error while creating a new profile"),
          reject,
        );
      } else {
        // update existing profile
        const profile = {
          ...queryProfileResult,
          email: profileModelPayload.email,
        };
        profileModel.updateProfile(profile).then(
          (p) => p !== null ? asPublicExtendedProfile(p) : null,
          reject,
        ).then(
          handleNullableResultAndRespond(resolve, "Error while updating the profile"),
          reject,
        );
      }
    });
  });
}

/**
 * Wraps an UpsertProfile handler inside an Express request handler.
 */
export function UpsertProfile(
  profileModel: ProfileModel,
): express.RequestHandler {
  const handler = UpsertProfileHandler(profileModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.TrustedApp])),
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
