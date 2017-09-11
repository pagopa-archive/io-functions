import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModelVersioned, IVersionedModel, ModelId } from "../utils/documentdb_model_versioned";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { fiscalCodeToModelId } from "../utils/conversions";
import { FiscalCode } from "../utils/fiscalcode";
import { NonNegativeNumber } from "../utils/numbers";
import { LimitedFields } from "../utils/types";

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
export interface INewProfile extends IProfile, DocumentDb.NewDocument, IVersionedModel {
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

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedProfile {
  return ({
    ...result,
    kind: "IRetrievedProfile",
  } as IRetrievedProfile);
}

function getModelId(o: IProfile): ModelId {
  return fiscalCodeToModelId(o.fiscalCode);
}

function updateModelId(o: IProfile, id: string, version: NonNegativeNumber): INewProfile {
  const newProfile: INewProfile = {
    ...o,
    id,
    kind: "INewProfile",
    version,
  };

  return newProfile;
}

function toBaseType(o: IRetrievedProfile): IProfile {
  return {
    email: o.email,
    fiscalCode: o.fiscalCode,
  };
}

/**
 * A model for handling Profiles
 */
export class ProfileModel extends DocumentDbModelVersioned<IProfile, INewProfile, IRetrievedProfile> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Profile model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri) {
    super();
    // tslint:disable-next-line:no-object-mutation
    this.toRetrieved = toRetrieved;
    // tslint:disable-next-line:no-object-mutation
    this.getModelId = getModelId;
    // tslint:disable-next-line:no-object-mutation
    this.versionateModel = updateModelId;
    // tslint:disable-next-line:no-object-mutation
    this.toBaseType = toBaseType;
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUri = collectionUrl;
  }

  /**
   * Searches for one profile associated to the provided fiscal code
   *
   * @param fiscalCode
   */
  public findOneProfileByFiscalCode(
    fiscalCode: FiscalCode,
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedProfile>>> {
    return super.findLastVersionByModelId(
      "profiles",
      "fiscalCode",
      fiscalCode,
    );
  }

}
