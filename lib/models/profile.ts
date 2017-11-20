import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  IVersionedModel,
  ModelId
} from "../utils/documentdb_model_versioned";

import { Either } from "fp-ts/lib/Either";
import { Option } from "ts-option";

import { EmailAddress } from "../api/definitions/EmailAddress";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { fiscalCodeToModelId } from "../utils/conversions";
import { NonNegativeNumber } from "../utils/numbers";
import { NonEmptyString } from "../utils/strings";

/**
 * Base interface for Profile objects
 */
export interface IProfile {
  // the fiscal code of the citized associated to this profile
  readonly fiscalCode: FiscalCode;

  // the preferred email for receiving email notifications
  // if defined, will override the default email provided by the API client
  // if defined, will enable email notifications for the citizen
  readonly email?: EmailAddress;

  // whether to store the content of messages sent to this citizen
  readonly isStorageOfMessageContentEnabled?: boolean;
}

/**
 * Interface for new Profile objects
 */
export interface INewProfile
  extends IProfile,
    DocumentDb.NewDocument,
    IVersionedModel {
  readonly kind: "INewProfile";
}

/**
 * Interface for retrieved Profile objects
 *
 * Existing profile records have a version number.
 */
export interface IRetrievedProfile
  extends IProfile,
    DocumentDb.RetrievedDocument,
    IVersionedModel {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedProfile";
}

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedProfile {
  return {
    ...result,
    kind: "IRetrievedProfile"
  } as IRetrievedProfile;
}

function getModelId(o: IProfile): ModelId {
  return fiscalCodeToModelId(o.fiscalCode);
}

function updateModelId(
  o: IProfile,
  id: string,
  version: NonNegativeNumber
): INewProfile {
  const newProfile: INewProfile = {
    ...o,
    id,
    kind: "INewProfile",
    version
  };

  return newProfile;
}

function toBaseType(o: IRetrievedProfile): IProfile {
  return {
    email: o.email,
    fiscalCode: o.fiscalCode
  };
}

/**
 * A model for handling Profiles
 */
export class ProfileModel extends DocumentDbModelVersioned<
  IProfile,
  INewProfile,
  IRetrievedProfile
> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

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
    fiscalCode: FiscalCode
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedProfile>>> {
    return super.findLastVersionByModelId("profiles", "fiscalCode", fiscalCode);
  }
}
