import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

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
   * Creates a new document or update an existing one
   * with the provided id.
   *
   */
  public async createOrUpdate(
    document: TN,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // we don't want to store the "kind" property, let's remove it
    const kindlessDocument = Object.assign(Object.assign({}, document), {
      kind: undefined
    });

    // attempt to persist the document
    const maybeCreatedOrUpdatedDocument = await DocumentDbUtils.upsertDocument(
      this.dbClient,
      this.collectionUri,
      kindlessDocument,
      partitionKey
    );

    // if the result is successful we map it to a TR type
    return maybeCreatedOrUpdatedDocument.map(this.toRetrieved);
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
   * Returns all the documents in this collection.
   *
   * @param recipient The fiscalCode of the recipient user
   */
  /* istanbul ignore next */
  public findAll(): DocumentDbUtils.IResultIterator<TR> {
    return DocumentDbUtils.queryDocuments(this.dbClient, this.collectionUri, {
      parameters: [],
      query: `SELECT * FROM n`
    });
  }

  /**
   * Get an iterator to process all documents of the collection.
   *
   * @param documentId    The ID of the document to retrieve.
   * @param partitionKey  The partitionKey associated to this model.
   */
  public async getCollectionIterator(): Promise<
    DocumentDbUtils.IResultIterator<TR>
  > {
    const documentsIterator = DocumentDbUtils.queryAllDocuments(
      this.dbClient,
      this.collectionUri
    );
    return DocumentDbUtils.mapResultIterator(
      documentsIterator,
      this.toRetrieved
    );
  }

  /**
   * Deletes a document in the data store.
   */
  public async delete(
    documentLink: string
  ): Promise<Either<DocumentDb.QueryError, void>> {
    return await DocumentDbUtils.deleteDocument(this.dbClient, documentLink);
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
