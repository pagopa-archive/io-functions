/*
 * Implements the API handlers for the Profile resource.
 */

import * as express from "express";

import { left, right } from "../utils/either";

import { FiscalCode } from "../utils/fiscalcode";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup,
} from "../utils/middlewares/azure_api_auth";
import { FiscalCodeMiddleware } from "../utils/middlewares/fiscalcode";
import { isNonEmptyString, NonEmptyString } from "../utils/strings";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler,
} from "../utils/request_middleware";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorQuery,
  ResponseErrorValidation,
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
  IResponseErrorQuery
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
  IResponseErrorQuery |
  IResponseErrorInternal
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
        if (auth.groups.has(UserGroup.ApiFullProfileRead)) {
          // if the client is a trusted application we return the
          // extended profile
          return(ResponseSuccessJson(asPublicExtendedProfile(profile)));
        } else {
          // or else, we return a limited profile
          return(ResponseSuccessJson(asPublicLimitedProfile(profile)));
        }
      } else {
        return(ResponseErrorNotFound("Profile not found", "The profile you requested was not found in the system."));
      }
    } else {
      return(ResponseErrorQuery("Error while retrieving the profile", errorOrMaybeProfile.left));
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
      UserGroup.ApiLimitedProfileRead,
      UserGroup.ApiFullProfileRead,
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
  readonly email?: NonEmptyString;
}

/**
 * A middleware that extracts a Profile payload from a request.
 *
 * TODO: validate the payload against a schema.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<IResponseErrorValidation, IProfilePayload> =
  (request) => {
    const email = request.body.email;
    if (email && !isNonEmptyString(email)) {
      return(Promise.resolve(left(ResponseErrorValidation("Invalid email", "email must be a non-empty string"))));
    }

    return Promise.resolve(right({
      email,
    }));
  };

async function createNewProfileFromPayload(
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  profileModelPayload: IProfilePayload,
): Promise<IResponseSuccessJson<IPublicExtendedProfile> | IResponseErrorQuery> {
  // create a new profile
  const profile: IProfile = {
    email: profileModelPayload.email,
    fiscalCode,
  };
  const errorOrProfile = await profileModel.create(profile, profile.fiscalCode);
  const errorOrProfileAsPublicExtendedProfile = errorOrProfile.mapRight(asPublicExtendedProfile);
  if (errorOrProfileAsPublicExtendedProfile.isRight) {
    return(ResponseSuccessJson(errorOrProfileAsPublicExtendedProfile.right));
  } else {
    return(ResponseErrorQuery("Error while creating a new profile", errorOrProfileAsPublicExtendedProfile.left));
  }
}

async function updateExistingProfileFromPayload(
  profileModel: ProfileModel,
  existingProfile: IRetrievedProfile,
  profileModelPayload: IProfilePayload,
): Promise<IResponseSuccessJson<IPublicExtendedProfile> | IResponseErrorQuery | IResponseErrorInternal> {
  const errorOrMaybeProfile = await profileModel.update(
    existingProfile.fiscalCode,
    existingProfile.fiscalCode,
    (p) => {
      return {
        ...p,
        email: profileModelPayload.email,
      };
    },
  );

  if (errorOrMaybeProfile.isLeft) {
    return(ResponseErrorQuery("Error while updating the existing profile", errorOrMaybeProfile.left));
  }

  const maybeProfile = errorOrMaybeProfile.right;

  if (maybeProfile.isEmpty) {
    // this should never happen since if the profile doesn't exist this function
    // will never be called, but let's deal with this anyway, you never know
    return(ResponseErrorInternal("Error while updating the existing profile, the profile does not exist!"));
  }

  const profile = maybeProfile.get;

  const publicExtendedProfile = asPublicExtendedProfile(profile);

  return ResponseSuccessJson(publicExtendedProfile);
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
      return(ResponseErrorQuery("Error", errorOrMaybeProfile.left));
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
      UserGroup.ApiProfileWrite,
    ])),
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
