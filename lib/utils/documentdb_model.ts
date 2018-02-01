import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";

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
  constructor(
    // instance of a DocumentDB client
    protected readonly dbClient: DocumentDb.DocumentClient,
    // the URI of the collection associated to this model
    protected readonly collectionUri: DocumentDbUtils.IDocumentDbCollectionUri,
    // An helper that converts a retrieved document to the base document type
    protected readonly toBaseType: (o: TR) => T,
    // An helper that converts the result of a query (a plain DocumentDB document
    // to the retrieved type).
    protected readonly toRetrieved: (result: DocumentDb.RetrievedDocument) => TR
  ) {}

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
    return maybeCreatedDocument.map(this.toRetrieved);
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

    if (isLeft(errorOrDocument) && errorOrDocument.value.code === 404) {
      // if the error is 404 (Not Found), we return an empty value
      return right(none);
    }

    // for any other error (errorOrDocument is a left), we return it as is
    // or in case of success, we map the result to a retrieved interface
    return errorOrDocument.map(r => some(this.toRetrieved(r)));
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
    if (isLeft(errorOrMaybeCurrent)) {
      // if the query returned an error, forward it
      return errorOrMaybeCurrent;
    }

    const maybeCurrent = errorOrMaybeCurrent.value;

    if (isNone(maybeCurrent)) {
      return right(maybeCurrent);
    }

    const currentRetrievedDocument = maybeCurrent.value;
    const currentObject = this.toBaseType(currentRetrievedDocument);

    const updatedObject = updater(currentObject);

    const kindlessNewDocument: T & DocumentDb.NewDocument = Object.assign(
      Object.assign({}, updatedObject),
      {
        id: documentId,
        kind: undefined
      }
    );

    const updatedDocument = await DocumentDbUtils.replaceDocument(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
      kindlessNewDocument,
      partitionKey
    );

    return updatedDocument.map(this.toRetrieved).map(some);
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
  ): Promise<Either<DocumentDb.QueryError, Option<DocumentDb.AttachmentMeta>>> {
    // we do not try to retrieve the document before attaching media,
    // the operation will fail automatically on non existing documents
    const attachmentMeta = await DocumentDbUtils.upsertAttachment(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
      attachment,
      { partitionKey }
    );

    if (isLeft(attachmentMeta)) {
      return left(attachmentMeta.value);
    }

    // return the attachment media information
    return right(fromNullable(attachmentMeta.value));
  }

  /**
   * Get attachments (media link) for the given model.
   * You *must* provide a partitionKey through FeedOptions.
   */
  public async getAttachments(
    documentId: string,
    options: DocumentDb.FeedOptions
  ): Promise<DocumentDbUtils.IResultIterator<DocumentDb.AttachmentMeta>> {
    return DocumentDbUtils.queryAttachments(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, documentId),
      options
    );
  }
}
