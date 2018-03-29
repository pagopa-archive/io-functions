/*
 * Implements the API handlers for the Profile resource.
 */
import * as express from "express";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone, isSome } from "fp-ts/lib/Option";
import { ExtendedProfile } from "../api/definitions/ExtendedProfile";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { LimitedProfile } from "../api/definitions/LimitedProfile";

import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../utils/middlewares/azure_user_attributes";

import {
  ClientIp,
  ClientIpMiddleware
} from "../utils/middlewares/client_ip_middleware";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";
import { FiscalCodeMiddleware } from "../utils/middlewares/fiscalcode";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";

import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorQuery,
  ResponseSuccessJson
} from "../utils/response";

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

import { Profile, ProfileModel, RetrievedProfile } from "../models/profile";
import { ServiceModel } from "../models/service";

function toExtendedProfile(profile: RetrievedProfile): ExtendedProfile {
  return {
    email: profile.email,
    is_inbox_enabled: profile.isInboxEnabled,
    is_webhook_enabled: profile.isWebhookEnabled,
    preferred_languages: profile.preferredLanguages,
    version: profile.version
  };
}

function toLimitedProfile(_: RetrievedProfile): LimitedProfile {
  return {};
}

/**
 * Type of a GetProfile handler.
 *
 * GetProfile expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetProfileHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJson<LimitedProfile>
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorNotFound
  | IResponseErrorQuery
>;

/**
 * Type of an UpsertProfile handler.
 *
 * UpsertProfile expects a FiscalCode and a Profile as input and
 * returns a Profile or a Validation or a Generic error.
 */
type IUpsertProfileHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  profileModelPayload: ExtendedProfile
) => Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

/**
 * Return a type safe GetProfile handler.
 */
export function GetProfileHandler(
  profileModel: ProfileModel
): IGetProfileHandler {
  return async (auth, _, __, fiscalCode) => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );
    if (isRight(errorOrMaybeProfile)) {
      const maybeProfile = errorOrMaybeProfile.value;
      if (isSome(maybeProfile)) {
        const profile = maybeProfile.value;
        if (auth.groups.has(UserGroup.ApiFullProfileRead)) {
          // if the client is a trusted application we return the
          // extended profile
          return ResponseSuccessJson(toExtendedProfile(profile));
        } else {
          // or else, we return a limited profile
          return ResponseSuccessJson(toLimitedProfile(profile));
        }
      } else {
        return ResponseErrorNotFound(
          "Profile not found",
          "The profile you requested was not found in the system."
        );
      }
    } else {
      return ResponseErrorQuery(
        "Error while retrieving the profile",
        errorOrMaybeProfile.value
      );
    }
  };
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
export function GetProfile(
  serviceModel: ServiceModel,
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = GetProfileHandler(profileModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiLimitedProfileRead, UserGroup.ApiFullProfileRead])
    ),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __) => ipTuple(c, u))
    )
  );
}

/**
 * A middleware that extracts a Profile payload from a request.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  ExtendedProfile
> = request =>
  new Promise(resolve => {
    const validation = ExtendedProfile.decode(request.body);
    const result = validation.mapLeft(
      ResponseErrorFromValidationErrors(ExtendedProfile)
    );
    resolve(result);
  });

async function createNewProfileFromPayload(
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  profileModelPayload: ExtendedProfile
): Promise<IResponseSuccessJson<ExtendedProfile> | IResponseErrorQuery> {
  // create a new profile
  const profile: Profile = {
    email: profileModelPayload.email,
    fiscalCode,
    isInboxEnabled: profileModelPayload.is_inbox_enabled,
    isWebhookEnabled: profileModelPayload.is_webhook_enabled,
    preferredLanguages: profileModelPayload.preferred_languages
  };
  const errorOrProfile = await profileModel.create(profile, profile.fiscalCode);
  const errorOrProfileAsPublicExtendedProfile = errorOrProfile.map(
    toExtendedProfile
  );
  if (isRight(errorOrProfileAsPublicExtendedProfile)) {
    return ResponseSuccessJson(errorOrProfileAsPublicExtendedProfile.value);
  } else {
    return ResponseErrorQuery(
      "Error while creating a new profile",
      errorOrProfileAsPublicExtendedProfile.value
    );
  }
}

async function updateExistingProfileFromPayload(
  profileModel: ProfileModel,
  existingProfile: RetrievedProfile,
  profileModelPayload: ExtendedProfile
): Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorQuery
  | IResponseErrorInternal
> {
  const errorOrMaybeProfile = await profileModel.update(
    existingProfile.id,
    existingProfile.fiscalCode,
    p => {
      return {
        ...p,
        email: profileModelPayload.email,
        isInboxEnabled: profileModelPayload.is_inbox_enabled,
        isWebhookEnabled: profileModelPayload.is_webhook_enabled,
        preferredLanguages: profileModelPayload.preferred_languages
      };
    }
  );

  if (isLeft(errorOrMaybeProfile)) {
    return ResponseErrorQuery(
      "Error while updating the existing profile",
      errorOrMaybeProfile.value
    );
  }

  const maybeProfile = errorOrMaybeProfile.value;

  if (isNone(maybeProfile)) {
    // this should never happen since if the profile doesn't exist this function
    // will never be called, but let's deal with this anyway, you never know
    return ResponseErrorInternal(
      "Error while updating the existing profile, the profile does not exist!"
    );
  }

  const profile = maybeProfile.value;

  const publicExtendedProfile = toExtendedProfile(profile);

  return ResponseSuccessJson(publicExtendedProfile);
}

/**
 * This handler will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 */
export function UpsertProfileHandler(
  profileModel: ProfileModel
): IUpsertProfileHandler {
  return async (_, __, ___, fiscalCode, profileModelPayload) => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );
    if (isRight(errorOrMaybeProfile)) {
      const maybeProfile = errorOrMaybeProfile.value;
      if (isNone(maybeProfile)) {
        // create a new profile
        return createNewProfileFromPayload(
          profileModel,
          fiscalCode,
          profileModelPayload
        );
      } else {
        const existingProfile = maybeProfile.value;
        // verify that the client asked to update the latest version
        if (profileModelPayload.version !== existingProfile.version) {
          return ResponseErrorConflict(
            `Version ${profileModelPayload.version} is not the latest version.`
          );
        }
        // update existing profile
        return updateExistingProfileFromPayload(
          profileModel,
          existingProfile,
          profileModelPayload
        );
      }
    } else {
      return ResponseErrorQuery("Error", errorOrMaybeProfile.value);
    }
  };
}

/**
 * Wraps an UpsertProfile handler inside an Express request handler.
 */
export function UpsertProfile(
  serviceModel: ServiceModel,
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = UpsertProfileHandler(profileModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiProfileWrite])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __, ___) => ipTuple(c, u))
    )
  );
}
