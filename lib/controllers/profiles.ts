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

import {
  IResponseErrorGeneric,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorGeneric,
  ResponseErrorNotFound,
  ResponseSuccessJson,
} from "../utils/response";

import {
  asPublicExtendedProfile,
  asPublicLimitedProfile,
  IProfile,
  IPublicExtendedProfile,
  IPublicLimitedProfile,
  IRetrievedProfile,
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
  IResponseErrorNotFound |
  IResponseErrorGeneric
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
 */
export function GetProfileHandler(profileModel: ProfileModel): IGetProfileHandler {
  return async (auth, fiscalCode) => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(fiscalCode);
    if (errorOrMaybeProfile.isRight) {
      const maybeProfile = errorOrMaybeProfile.right;
      if (maybeProfile.isDefined) {
        const profile = maybeProfile.get;
        if (auth.groups.has(UserGroup.TrustedApplications)) {
          // if the client is a trusted application we return the
          // extended profile
          return(ResponseSuccessJson(asPublicExtendedProfile(profile)));
        } else {
          // or else, we return a limited profile
          return(ResponseSuccessJson(asPublicLimitedProfile(profile)));
        }
      } else {
        return(ResponseErrorNotFound("Profile not found"));
      }
    } else {
      return ResponseErrorGeneric(
        `Error while retrieving the profile|${errorOrMaybeProfile.left.code}`,
      );
    }
  };
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
export function GetProfile(
  profileModel: ProfileModel,
): express.RequestHandler {
  const handler = GetProfileHandler(profileModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([
      UserGroup.Developers,
    ])),
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
  readonly email?: string;
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

async function createNewProfileFromPayload(
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  profileModelPayload: IProfilePayload,
): Promise<IResponseSuccessJson<IPublicExtendedProfile> | IResponseErrorGeneric> {
  // create a new profile
  const profile: IProfile = {
    email: profileModelPayload.email,
    fiscalCode,
  };
  const errorOrProfile = await profileModel.create(profile);
  const errorOrProfileAsPublicExtendedProfile = errorOrProfile.mapRight(asPublicExtendedProfile);
  if (errorOrProfileAsPublicExtendedProfile.isRight) {
    return ResponseSuccessJson(errorOrProfileAsPublicExtendedProfile.right);
  } else {
    return ResponseErrorGeneric(
      `Error while creating a new profile|${errorOrProfileAsPublicExtendedProfile.left.code}`,
    );
  }
}

async function updateExistingProfileFromPayload(
  profileModel: ProfileModel,
  existingProfile: IRetrievedProfile,
  profileModelPayload: IProfilePayload,
): Promise<IResponseSuccessJson<IPublicExtendedProfile> | IResponseErrorGeneric> {
  const profile = {
    ...existingProfile,
    email: profileModelPayload.email,
  };
  const errorOrProfile = await profileModel.updateProfile(profile);
  const errorOrProfileAsPublicExtendedProfile = errorOrProfile.mapRight(asPublicExtendedProfile);
  if (errorOrProfileAsPublicExtendedProfile.isRight) {
    return ResponseSuccessJson(errorOrProfileAsPublicExtendedProfile.right);
  } else {
    return ResponseErrorGeneric(
      `Error while updating the existing profile|${errorOrProfileAsPublicExtendedProfile.left.code}`,
    );
  }
}

/**
 * This handler will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 */
export function UpsertProfileHandler(profileModel: ProfileModel): IUpsertProfileHandler {
  return async (_, fiscalCode, profileModelPayload) => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(fiscalCode);
    if (errorOrMaybeProfile.isRight) {
      const maybeProfile = errorOrMaybeProfile.right;
      if (maybeProfile.isEmpty) {
        // create a new profile
        return createNewProfileFromPayload(profileModel, fiscalCode, profileModelPayload);
      } else {
        // update existing profile
        return updateExistingProfileFromPayload(profileModel, maybeProfile.get, profileModelPayload);
      }
    } else {
      return ResponseErrorGeneric(
        `Error|${errorOrMaybeProfile.left.code}`,
      );
    }
  };
}

/**
 * Wraps an UpsertProfile handler inside an Express request handler.
 */
export function UpsertProfile(
  profileModel: ProfileModel,
): express.RequestHandler {
  const handler = UpsertProfileHandler(profileModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([
      UserGroup.TrustedApplications,
    ])),
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
