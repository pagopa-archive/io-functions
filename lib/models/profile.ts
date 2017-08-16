import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { FiscalCode } from "../utils/fiscalcode";

/**
 * Base interface for Profile objects
 */
interface IProfile {
  fiscalCode: FiscalCode;
  email?: string;
  // version: number;
}

/**
 * Interface for new Profile objects
 */
export interface INewProfile extends IProfile, DocumentDb.NewDocument { }

/**
 * Interface for retrieved Profile objects
 */
export interface IRetrievedProfile extends IProfile, DocumentDb.RetrievedDocument { }

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
    this.dbClient = dbClient;
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
        query: "SELECT * FROM profiles p WHERE (p.fiscalCode = @fiscalCode)",
      },
    );
  }

  /**
   * Upserts a Profile
   *
   * TODO: add versioning
   *
   * @param profile The new Profile object
   */
  public createOrUpdateProfile(profile: INewProfile): Promise<IRetrievedProfile | null> {
    return new Promise((resolve, reject) => {
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        profile,
      ).then(
        (result) => resolve(result),
        (error) => reject(error),
      );
    });
  }

}
