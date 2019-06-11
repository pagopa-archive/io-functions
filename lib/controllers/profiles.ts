/*
 * Implements the API handlers for the Profile resource.
 */
import * as express from "express";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone, isSome } from "fp-ts/lib/Option";
import { ExtendedProfile } from "../api/definitions/ExtendedProfile";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { LimitedProfile } from "../api/definitions/LimitedProfile";
import { Profile as LimitedOrExtendedProfile } from "../api/definitions/Profile";

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
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { IResponseErrorQuery, ResponseErrorQuery } from "../utils/response";

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

import { IContext } from "azure-function-express";
import {
  IProfileBlockedInboxOrChannels,
  Profile,
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";
import { ServiceModel } from "io-functions-commons/dist/src/models/service";
import { BlockedInboxOrChannelEnum } from "../api/definitions/BlockedInboxOrChannel";
import { ServiceId } from "../api/definitions/ServiceId";
import { ContextMiddleware } from "../utils/middlewares/context_middleware";

export interface IProfileCreatedEvent {
  readonly kind: "ProfileCreatedEvent";
  readonly fiscalCode: FiscalCode;
  readonly newProfile: ExtendedProfile;
}

export interface IProfileUpdatedEvent {
  readonly kind: "ProfileUpdatedEvent";
  readonly fiscalCode: FiscalCode;
  readonly oldProfile: ExtendedProfile;
  readonly newProfile: ExtendedProfile;
}

interface IBindings {
  // tslint:disable-next-line:readonly-keyword
  profileEvent?: IProfileCreatedEvent | IProfileUpdatedEvent;
}

function toExtendedProfile(profile: RetrievedProfile): ExtendedProfile {
  return {
    accepted_tos_version: profile.acceptedTosVersion,
    blocked_inbox_or_channels: profile.blockedInboxOrChannels,
    email: profile.email,
    is_inbox_enabled: profile.isInboxEnabled === true,
    is_webhook_enabled: profile.isWebhookEnabled === true,
    preferred_languages: profile.preferredLanguages,
    version: profile.version
  };
}

/**
 * Whether the sender service is allowed to send
 * notififications to the user identified by this profile
 */
export function isSenderAllowed(
  blockedInboxOrChannels: IProfileBlockedInboxOrChannels | undefined,
  serviceId: ServiceId
): boolean {
  return (
    blockedInboxOrChannels === undefined ||
    blockedInboxOrChannels[serviceId] === undefined ||
    !blockedInboxOrChannels[serviceId].has(BlockedInboxOrChannelEnum.INBOX)
  );
}

function toLimitedProfile(
  profile: RetrievedProfile,
  senderAllowed: boolean
): LimitedProfile {
  return {
    preferred_languages: profile.preferredLanguages,
    // computed property
    sender_allowed: senderAllowed
  };
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
  | IResponseSuccessJson<LimitedOrExtendedProfile>
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
  context: IContext<IBindings>,
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  profileModelPayload: ExtendedProfile
) => Promise<
  // tslint:disable-next-line:max-union-size
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
  return async (auth, _, userAttributes, fiscalCode) => {
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
          return ResponseSuccessJson(
            toLimitedProfile(
              profile,
              isSenderAllowed(
                profile.blockedInboxOrChannels,
                userAttributes.service.serviceId
              )
            )
          );
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
  const profile: Profile = {
    acceptedTosVersion: profileModelPayload.accepted_tos_version,
    blockedInboxOrChannels: profileModelPayload.blocked_inbox_or_channels,
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
  const profile: Profile = {
    acceptedTosVersion: profileModelPayload.accepted_tos_version,
    blockedInboxOrChannels: profileModelPayload.blocked_inbox_or_channels,
    email: profileModelPayload.email,
    fiscalCode: existingProfile.fiscalCode,
    isInboxEnabled: profileModelPayload.is_inbox_enabled,
    isWebhookEnabled: profileModelPayload.is_webhook_enabled,
    preferredLanguages: profileModelPayload.preferred_languages
  };

  const errorOrMaybeProfile = await profileModel.update(
    existingProfile.id,
    existingProfile.fiscalCode,
    p => {
      return {
        ...p,
        ...profile
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

  return maybeProfile.foldL<
    IResponseErrorInternal | IResponseSuccessJson<ExtendedProfile>
  >(
    () =>
      // this should never happen since if the profile doesn't exist this function
      // will never be called, but let's deal with this anyway, you never know
      ResponseErrorInternal(
        "Error while updating the existing profile, the profile does not exist!"
      ),
    p => ResponseSuccessJson(toExtendedProfile(p))
  );
}

/**
 * This handler will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 */
export function UpsertProfileHandler(
  profileModel: ProfileModel
): IUpsertProfileHandler {
  return async (context, _, __, ___, fiscalCode, profileModelPayload) => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );
    if (isLeft(errorOrMaybeProfile)) {
      return ResponseErrorQuery("Error", errorOrMaybeProfile.value);
    }
    const maybeProfile = errorOrMaybeProfile.value;

    if (isNone(maybeProfile)) {
      // create a new profile
      const response = await createNewProfileFromPayload(
        profileModel,
        fiscalCode,
        profileModelPayload
      );
      // if we successfully created the user's profile
      // broadcast a profile-created event
      if (response.kind === "IResponseSuccessJson") {
        // tslint:disable-next-line:no-object-mutation
        context.bindings.profileEvent = {
          fiscalCode,
          kind: "ProfileCreatedEvent",
          newProfile: response.value
        };
      }
      return response;
    } else {
      const existingProfile = maybeProfile.value;
      // verify that the client asked to update the latest version
      if (profileModelPayload.version !== existingProfile.version) {
        return ResponseErrorConflict(
          `Version ${profileModelPayload.version} is not the latest version.`
        );
      }
      // update existing profile
      const response = await updateExistingProfileFromPayload(
        profileModel,
        existingProfile,
        profileModelPayload
      );
      // if we successfully updated the user's profile
      // broadcast a profile-updated event
      if (response.kind === "IResponseSuccessJson") {
        // tslint:disable-next-line:no-object-mutation
        context.bindings.profileEvent = {
          fiscalCode: existingProfile.fiscalCode,
          kind: "ProfileUpdatedEvent",
          newProfile: response.value,
          oldProfile: toExtendedProfile(existingProfile)
        };
      }
      return response;
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
    ContextMiddleware<IBindings>(),
    AzureApiAuthMiddleware(new Set([UserGroup.ApiProfileWrite])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, __, c, u, ___, ____) =>
        ipTuple(c, u)
      )
    )
  );
}
