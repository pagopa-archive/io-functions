import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { toNonNegativeNumber } from "../utils/numbers";
import { generateVersionedModelId, IVersionedModel, ModelId } from "../utils/versioned_model";

/**
 * Base interface for Organization objects
 */
interface IOrganization {
  readonly organizationId: ModelId;
  readonly name: string;
}

/**
 * Interface for new Organization objects
 */
export interface INewOrganization extends IOrganization, DocumentDb.NewDocument {
  readonly kind: "INewOrganization";
}

/**
 * Interface for retrieved Organization objects
 *
 * Existing Organization records have a version number.
 */
export interface IRetrievedOrganization extends IOrganization, DocumentDb.RetrievedDocument, IVersionedModel {
  readonly kind: "IRetrievedOrganization";
  readonly organizationId: ModelId; // organizationId should never change
}

/**
 * A model for handling Organizations
 */
export class OrganizationModel {
  private dbClient: DocumentDb.DocumentClient;
  private collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Organization model
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
   * Searches for one Organization associated to the provided ID
   *
   * @param fiscalCode
   */
  public findLastVersionById(
    organizationId: string,
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedOrganization>>> {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUrl,
      {
        parameters: [{
          name: "@organizationId",
          value: organizationId,
        }],
        query: "SELECT * FROM organizations o WHERE (o.organizationId = @organizationId) ORDER BY o.version DESC",
      },
    );
  }

  /**
   * Create a new Profile
   *
   * @param organization The new Profile object
   */
  public async createOrganization(
    organization: IOrganization,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedOrganization>> {
    // the first version of a profile is 0
    const initialVersion = toNonNegativeNumber(0).get;
    const recordId = generateVersionedModelId(organization.organizationId, initialVersion);
    const errorOrDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      {
        ...organization,
        id: recordId,
        version: initialVersion,
      },
      organization.organizationId,
    );
    return errorOrDocument.mapRight((document) => ({
      ...document,
      kind: "IRetrievedOrganization",
    } as IRetrievedOrganization));
  }

  /**
   * Update an existing Organization by creating a new version
   *
   * @param organization The updated Profile object
   */
  public updateOrganization(
    organization: IRetrievedOrganization,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedOrganization>> {
    const newVersion = toNonNegativeNumber(organization.version + 1).get;
    const recordId = generateVersionedModelId(organization.fiscal, newVersion);
    return DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      {
        ...organization,
        id: recordId,
        version: newVersion,
      },
      organization.organizationId,
    );
  }

}
