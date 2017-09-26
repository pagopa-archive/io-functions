import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { none, Option, some } from "ts-option";

import { Either, left, right } from "./either";

/**
 * A persisted data model backed by a DocumentDB client: this base class
 * abstracts the semantics of the DocumentDB API, by providing the shared code
 * for persisting, retrieving and updating a document model.
 * To create a new DocumentDB backed model, define a concrete class by extending
 * this abstract class.
 *
 * @param T   The base document type (i.e. an interface that defined the
 *            document attributes).
 * @param TN  The type of new documents (i.e. T & NewDocument)
 * @param TR  The type of retrieved documents (i.e. T & RetrievedDocument)
 */
export abstract class DocumentDbModel<
  T,
  TN extends T & DocumentDb.NewDocument,
  TR extends T & DocumentDb.RetrievedDocument
> {
  // instance of a DocumentDB client
  protected dbClient: DocumentDb.DocumentClient;

  // the URI of the collection associated to this model
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * An helper that converts a retrieved document to the base document type
   */
  protected toBaseType: (o: TR) => T;

  /**
   * An helper that converts the result of a query (a plain DocumentDB document
   * to the retrieved type).
   */
  protected toRetrieved: (result: DocumentDb.RetrievedDocument) => TR;

  /**
   * Creates a new document in the data store.
   *
   * For an explanation on how the data store gets partitioned, see
   * https://docs.microsoft.com/en-us/azure/cosmos-db/partition-data
   *
   * @param   {TN}      document        The new document to store.
   * @param   {string}  partitionKey    Documents will be partitioned using this
   *     key.
   * @return  {Promise<Either<DocumentDb.QueryError, TR>>} A Promise that
   *     resolves to either an error or the retrieved version of the persisted
   *     document.
   */
  public async create(
    document: TN,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // we don't want to store the "kind" property, let's remove it
    const kindlessDocument = Object.assign(Object.assign({}, document), {
      kind: undefined
    });

    // attempt to persist the document
    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUri,
      kindlessDocument,
      partitionKey
    );

    // if the result is successful we map it to a TR type
    return maybeCreatedDocument.mapRight(this.toRetrieved);
  }

  /**
   * Retrieves a document from the document ID.
   *
   * @param documentId    The ID of the document to retrieve.
   * @param partitionKey  The partitionKey associated to this model.
   */
  public async find(
    documentId: string,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // compose the URI of the document we're looking for
    const documentUri = DocumentDbUtils.getDocumentUri(
      this.collectionUri,
      documentId
    );

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

  /**
   * Updates (i.e. replaces) a document.
   *
   * @param documentId    The ID of the document to retrieve.
   * @param partitionKey  The partitionKey associated to this model.
   * @param updater       A function that gets called with the current document
   *    and should return the updated document.
   */
  public async update(
    documentId: string,
    partitionKey: string,
    updater: (current: T) => T
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // fetch the document
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

    const updatedObject = updater(currentObject);

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

  /**
   * Upsert an attachment for a specified document.
   * 
   * @param documentId    the id of the document
   * @param partitionKey  partition key of the document
   * @param attachment    attachment object (contentType and media link)
   */
  public async attach(
    documentId: string,
    partitionKey: string,
    attachment: DocumentDb.Attachment
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // we do not try to retrieve the document before attaching media,
    // the operation will fail automatically on non existing documents
    const attachmentMeta = await DocumentDbUtils.upsertAttachment(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
      attachment,
      { partitionKey }
    );

    if (attachmentMeta.isLeft) {
      return left(attachmentMeta.left);
    }

    // return the document with attachment media information
    return this.find(documentId, partitionKey);
  }

  public async getAttachments(
    documentId: string,
    options: DocumentDb.FeedOptions = {}
  ): Promise<ReadonlyArray<DocumentDb.AttachmentMeta>> {
    return DocumentDbUtils.iteratorToArray(
      DocumentDbUtils.queryAttachments(
        this.dbClient,
        DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
        options
      )
    );
  }
}
