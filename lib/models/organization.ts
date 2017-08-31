import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

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
  public findLastVersionById(organizationId: string): Promise<IRetrievedOrganization | null> {
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
  public createOrganization(organization: IOrganization): Promise<IRetrievedOrganization> {
    return new Promise((resolve, reject) => {
      // the first version of a profile is 0
      const initialVersion = toNonNegativeNumber(0).get;
      const recordId = generateVersionedModelId(organization.organizationId, initialVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...organization,
          id: recordId,
          version: initialVersion,
        },
        organization.organizationId,
      ).then(
        (result) => resolve({
          ...result,
          kind: "IRetrievedOrganization",
        }),
        (error) => reject(error),
      );
    });
  }

  /**
   * Update an existing Organization by creating a new version
   *
   * @param organization The updated Profile object
   */
  public updateOrganization(organization: IRetrievedOrganization): Promise<IRetrievedOrganization> {
    return new Promise((resolve, reject) => {
      const newVersion = toNonNegativeNumber(organization.version + 1).get;
      const recordId = generateVersionedModelId(organization.fiscal, newVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...organization,
          id: recordId,
          version: newVersion,
        },
        organization.organizationId,
      ).then(
        (result) => resolve(result),
        (error) => reject(error),
      );
    });
  }

}
