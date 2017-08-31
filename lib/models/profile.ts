import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { fiscalCodeToModelId } from "../utils/conversions";
import { FiscalCode } from "../utils/fiscalcode";
import { toNonNegativeNumber } from "../utils/numbers";
import { LimitedFields } from "../utils/types";
import { generateVersionedModelId, IVersionedModel } from "../utils/versioned_model";

/**
 * Base interface for Profile objects
 */
export interface IProfile {
  readonly fiscalCode: FiscalCode;
  readonly email?: string;
}

/**
 * Interface for new Profile objects
 */
export interface INewProfile extends IProfile, DocumentDb.NewDocument {
  readonly kind: "INewProfile";
}

/**
 * Interface for retrieved Profile objects
 *
 * Existing profile records have a version number.
 */
export interface IRetrievedProfile extends IProfile, DocumentDb.RetrievedDocument, IVersionedModel {
  readonly kind: "IRetrievedProfile";
}

/**
 * A profile that can be shared with user apps.
 */
export interface IPublicExtendedProfile extends
  Readonly<LimitedFields<IRetrievedProfile, "fiscalCode" | "email" | "version">> {
    readonly kind: "IPublicExtendedProfile";
}

/**
 * Converts a Profile to a PublicExtendedProfile
 */
export function asPublicExtendedProfile<T extends IRetrievedProfile>(profile: T): IPublicExtendedProfile {
  const {
    email,
    fiscalCode,
    version,
  } = profile;
  return {
    email,
    fiscalCode,
    kind: "IPublicExtendedProfile",
    version,
  };
}

/**
 * A profile that can be shared with 3rd parties.
 */
export interface IPublicLimitedProfile extends LimitedFields<IPublicExtendedProfile, "fiscalCode"> {
  readonly kind: "IPublicLimitedProfile";
}

/**
 * Converts a Profile to a PublicLimitedProfile
 */
export function asPublicLimitedProfile<T extends IProfile>(profile: T): IPublicLimitedProfile {
  const {
    fiscalCode,
  } = profile;
  return {
    fiscalCode,
    kind: "IPublicLimitedProfile",
  };
}

/**
 * A model for handling Profiles
 */
export class ProfileModel {
  private dbClient: DocumentDb.DocumentClient;
  private collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Profile model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl) {
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUrl = collectionUrl;
  }

  /**
   * Searches for one profile associated to the provided fiscal code
   *
   * @param fiscalCode
   */
  public findOneProfileByFiscalCode(fiscalCode: FiscalCode): Promise<IRetrievedProfile | null> {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUrl,
      {
        parameters: [{
          name: "@fiscalCode",
          value: fiscalCode,
        }],
        query: "SELECT * FROM profiles p WHERE (p.fiscalCode = @fiscalCode) ORDER BY p.version DESC",
      },
    );
  }

  /**
   * Create a new Profile
   *
   * @param profile The new Profile object
   */
  public createProfile(profile: IProfile): Promise<IRetrievedProfile> {
    return new Promise((resolve, reject) => {
      // the first version of a profile is 0
      const initialVersion = toNonNegativeNumber(0).get;
      // the ID of each profile version is composed of the profile ID and its version
      // this makes it possible to detect conflicting updates (concurrent creation of
      // profiles with the same profile ID and version)
      const profileId = generateVersionedModelId(fiscalCodeToModelId(profile.fiscalCode), initialVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...profile,
          id: profileId,
          version: initialVersion,
        },
        profile.fiscalCode,
      ).then(
        (result) => resolve({
          ...result,
          kind: "IRetrievedProfile",
        }),
        (error) => reject(error),
      );
    });
  }

  /**
   * Update an existing profile by creating a new version
   *
   * @param profile The updated Profile object
   */
  public updateProfile(profile: IRetrievedProfile): Promise<IRetrievedProfile> {
    return new Promise((resolve, reject) => {
      const newVersion = toNonNegativeNumber(profile.version + 1).get;
      const profileId = generateVersionedModelId(fiscalCodeToModelId(profile.fiscalCode), newVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...profile,
          id: profileId,
          version: newVersion,
        },
        profile.fiscalCode,
      ).then(
        (result) => resolve(result),
        (error) => reject(error),
      );
    });
  }

}
