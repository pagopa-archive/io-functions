import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { none, Option, some } from "ts-option";

import { Either, right } from "./either";

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
  public async find(
    id: string, partitionKey: string,
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    const documentUrl = DocumentDbUtils.getDocumentUri(
      this.collectionUri,
      id,
    );

    const errorOrDocument = await DocumentDbUtils.readDocument(
      this.dbClient,
      documentUrl,
      partitionKey,
    );

    if (errorOrDocument.isLeft && errorOrDocument.left.code === 404) {
      // if the error is 404 (Not Found), we return an empty value
      return right(none);
    }

    return errorOrDocument.mapRight((r) => some(this.toRetrieved(r)));
  }

}
