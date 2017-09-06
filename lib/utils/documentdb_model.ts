import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Option } from "ts-option";

import { Either } from "./either";

export abstract class DocumentDbModel<TN extends DocumentDb.NewDocument, TR extends DocumentDb.RetrievedDocument> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  protected toRetrieved: (result: DocumentDb.RetrievedDocument) => TR;

  /**
   * Creates a new object
   */
  public async create(
    document: TN,
    partitionKey: string,
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // we don't want to store the "kind" property, let's remove it
    const kindlessDocument = Object.assign(Object.assign({}, document), { kind: undefined });

    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUri,
      kindlessDocument,
      partitionKey,
    );
    return maybeCreatedDocument.mapRight(this.toRetrieved);
  }

  /**
   * Looks for a specific object
   */
  public async find<T>(id: T): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    const errorOrMaybeDocument = await DocumentDbUtils.queryOneDocument<TR>(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [{
          name: "@id",
          value: id,
        }],
        query: `SELECT * FROM ${this.collectionUri.collectionId} c WHERE (c.id = @id)`,
      },
    );
    return errorOrMaybeDocument.mapRight((maybeDocument) => maybeDocument.map(this.toRetrieved));
  }

}
