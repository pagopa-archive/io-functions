import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  IVersionedModel,
  ModelId
} from "../utils/documentdb_model_versioned";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { NonNegativeNumber } from "../utils/numbers";

/**
 * Base interface for Organization objects
 */
export interface IOrganization {
  readonly organizationId: ModelId;
  readonly name: string;
}

/**
 * Interface for new Organization objects
 */
export interface INewOrganization
  extends IOrganization,
    DocumentDb.NewDocument,
    IVersionedModel {
  readonly kind: "INewOrganization";
}

/**
 * Interface for retrieved Organization objects
 *
 * Existing Organization records have a version number.
 */
export interface IRetrievedOrganization
  extends IOrganization,
    DocumentDb.RetrievedDocument,
    IVersionedModel {
  readonly kind: "IRetrievedOrganization";
  readonly organizationId: ModelId; // organizationId should never change
}

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): IRetrievedOrganization {
  return {
    ...result,
    kind: "IRetrievedOrganization"
  } as IRetrievedOrganization;
}

function getModelId(o: IOrganization): ModelId {
  return o.organizationId;
}

function updateModelId(
  o: IOrganization,
  id: string,
  version: NonNegativeNumber
): INewOrganization {
  const newOrganization: INewOrganization = {
    ...o,
    id,
    kind: "INewOrganization",
    version
  };

  return newOrganization;
}

function toBaseType(o: IRetrievedOrganization): IOrganization {
  return {
    name: o.name,
    organizationId: o.organizationId
  };
}

/**
 * A model for handling Organizations
 */
export class OrganizationModel extends DocumentDbModelVersioned<
  IOrganization,
  INewOrganization,
  IRetrievedOrganization
> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Organization model
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
   * Searches for one Organization associated to the provided ID
   *
   * @param fiscalCode
   */
  public findByOrganizationId(
    organizationId: string
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedOrganization>>> {
    return super.findLastVersionByModelId(
      "organizations",
      "organizationId",
      organizationId
    );
  }
}
