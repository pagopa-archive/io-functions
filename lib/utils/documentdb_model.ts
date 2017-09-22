import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { none, Option, some } from "ts-option";

import { Either, right } from "./either";

export abstract class DocumentDbModel<
  T,
  TN extends T & DocumentDb.NewDocument,
  TR extends T & DocumentDb.RetrievedDocument
> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  protected toBaseType: (o: TR) => T;
  protected toRetrieved: (result: DocumentDb.RetrievedDocument) => TR;

  /**
   * Creates a new object
   */
  public async create(
    document: TN,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // we don't want to store the "kind" property, let's remove it
    const kindlessDocument = Object.assign(Object.assign({}, document), {
      kind: undefined
    });

    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUri,
      kindlessDocument,
      partitionKey
    );
    return maybeCreatedDocument.mapRight(this.toRetrieved);
  }

  /**
   * Looks for a specific object
   */
  public async find(
    id: string,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // compose the URI of the document we're looking for
    const documentUri = DocumentDbUtils.getDocumentUri(this.collectionUri, id);

    // attemp to retrieve the document by its URI
    // the result with be either a QueryError or the retrieved document
    const errorOrDocument = await DocumentDbUtils.readDocument(
      this.dbClient,
      documentUri,
      partitionKey
    );

    if (errorOrDocument.isLeft && errorOrDocument.left.code === 404) {
      // if the error is 404 (Not Found), we return an empty value
      return right(none);
    }

    // for any other error (errorOrDocument is a left), we return it as is
    // or in case of success, we map the result to a retrieved interface
    return errorOrDocument.mapRight(r => some(this.toRetrieved(r)));
  }

  public async update(
    documentId: string,
    partitionKey: string,
    f: (current: T) => T
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // fetch the notification
    const errorOrMaybeCurrent = await this.find(documentId, partitionKey);
    if (errorOrMaybeCurrent.isLeft) {
      // if the query returned an error, forward it
      return errorOrMaybeCurrent;
    }

    const maybeCurrent = errorOrMaybeCurrent.right;

    if (maybeCurrent.isEmpty) {
      return right(maybeCurrent);
    }

    const currentRetrievedDocument = maybeCurrent.get;
    const currentObject = this.toBaseType(currentRetrievedDocument);

    const updatedObject = f(currentObject);

    const kindlessNewDocument: T &
      DocumentDb.NewDocument = Object.assign(Object.assign({}, updatedObject), {
      id: documentId,
      kind: undefined
    });

    const updatedDocument = await DocumentDbUtils.replaceDocument(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
      kindlessNewDocument,
      partitionKey
    );

    return updatedDocument.mapRight(this.toRetrieved).mapRight(some);
  }
}
