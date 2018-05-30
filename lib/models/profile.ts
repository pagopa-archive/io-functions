import * as t from "io-ts";

import { readonlySetType, tag } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../utils/documentdb_model_versioned";

import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BlockedInboxOrChannel } from "../api/definitions/BlockedInboxOrChannel";
import { EmailAddress } from "../api/definitions/EmailAddress";
import { IsInboxEnabled } from "../api/definitions/IsInboxEnabled";
import { IsWebhookEnabled } from "../api/definitions/IsWebhookEnabled";
import { PreferredLanguages } from "../api/definitions/PreferredLanguages";
import { ServiceId } from "../api/definitions/ServiceId";
import { TaxCode } from "../api/definitions/TaxCode";
import { taxCodeToModelId } from "../utils/conversions";

const ProfileBlockedInboxOrChannels = t.dictionary(
  ServiceId,
  readonlySetType(BlockedInboxOrChannel, "ProfileBlockedInboxOrChannel"),
  "ProfileBlockedInboxOrChannels"
);

// typescript does not allow to have ServiceId as key type here
export interface IProfileBlockedInboxOrChannels {
  readonly [serviceId: string]: ReadonlySet<BlockedInboxOrChannel>;
}

/**
 * Base interface for Profile objects
 */
export const Profile = t.intersection([
  t.interface({
    // the tax code of the citized associated to this profile
    taxCode: TaxCode
  }),
  t.partial({
    // Notification channels blocked by the user;
    // each channel is related to a specific Service (sender)
    blockedInboxOrChannels: ProfileBlockedInboxOrChannels,

    // the preferred email for receiving email notifications
    // if defined, will override the default email provided by the API client
    // if defined, will enable email notifications for the citizen
    email: EmailAddress,

    // whether to store the content of messages sent to this citizen
    isInboxEnabled: IsInboxEnabled,

    // whether to push notifications to the default webhook
    isWebhookEnabled: IsWebhookEnabled,

    // array of user's preferred languages in ISO-3166-1-2 format
    // https://it.wikipedia.org/wiki/ISO_3166-2
    preferredLanguages: PreferredLanguages
  })
]);

export type Profile = t.TypeOf<typeof Profile>;

/**
 * Interface for new Profile objects
 */

interface INewProfileTag {
  readonly kind: "INewProfile";
}

export const NewProfile = tag<INewProfileTag>()(
  t.intersection([Profile, DocumentDbUtils.NewDocument, VersionedModel])
);

export type NewProfile = t.TypeOf<typeof NewProfile>;

/**
 * Interface for retrieved Profile objects
 *
 * Existing profile records have a version number.
 */
interface IRetrievedProfileTag {
  readonly kind: "IRetrievedProfile";
}

export const RetrievedProfile = tag<IRetrievedProfileTag>()(
  t.intersection([Profile, DocumentDbUtils.RetrievedDocument, VersionedModel])
);

export type RetrievedProfile = t.TypeOf<typeof RetrievedProfile>;

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedProfile {
  return RetrievedProfile.decode(result).getOrElseL(_ => {
    throw new Error("Fatal, result is not a valid RetrievedProfile");
  });
}

function getModelId(o: Profile): ModelId {
  return taxCodeToModelId(o.taxCode);
}

function updateModelId(
  o: Profile,
  id: NonEmptyString,
  version: NonNegativeNumber
): NewProfile {
  return {
    ...o,
    id,
    kind: "INewProfile",
    version
  };
}

function toBaseType(o: RetrievedProfile): Profile {
  return {
    email: o.email,
    taxCode: o.taxCode
  };
}

/**
 * A model for handling Profiles
 */
export class ProfileModel extends DocumentDbModelVersioned<
  Profile,
  NewProfile,
  RetrievedProfile
> {
  /**
   * Creates a new Profile model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(
      dbClient,
      collectionUrl,
      toBaseType,
      toRetrieved,
      getModelId,
      updateModelId
    );
  }

  /**
   * Searches for one profile associated to the provided tax code
   *
   * @param taxCode
   */
  public findOneProfileByTaxCode(
    taxCode: TaxCode
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedProfile>>> {
    return super.findLastVersionByModelId("taxCode", taxCode);
  }
}
