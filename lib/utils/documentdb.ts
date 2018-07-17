/*
 * Utility functions for interacting with DocumentDB
 *
 * These are mostly typesafe/async wrappers around methods
 * of the DocumentDb SDK.
 *
 * See http://azure.github.io/azure-documentdb-node/DocumentClient.html
 *
 */

import * as t from "io-ts";

import * as DocumentDb from "documentdb";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { isNone, none, Option, some } from "fp-ts/lib/Option";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";

//
// Definition of types
//

interface IDocumentDbUri {
  readonly uri: string;
}

export interface IDocumentDbDatabaseUri extends IDocumentDbUri {
  readonly kind: "DocumentDbDatabaseUri";
  readonly databaseId: string;
}

export interface IDocumentDbCollectionUri extends IDocumentDbUri {
  readonly kind: "DocumentDbCollectionUri";
  readonly collectionId: string;
  readonly databaseUri: IDocumentDbDatabaseUri;
}

export interface IDocumentDbDocumentUri extends IDocumentDbUri {
  readonly kind: "DocumentDbDocumentUri";
  readonly documentId: string;
  readonly collectionUri: IDocumentDbCollectionUri;
}

//
// mapping of DocumentDb types to io-ts types
//

export const UniqueId = t.interface({
  id: NonEmptyString
});

export const NewDocument = t.intersection([
  t.partial({
    ttl: t.number
  }),
  UniqueId
]);

export const RetrievedDocument = t.intersection([
  NewDocument,
  t.interface({
    /** The self link. */
    _self: t.string,

    /** The time the object was created. */
    _ts: t.number
  }),
  t.partial({
    _attachments: t.string,
    _etag: t.string,
    _rid: t.string
  })
]);

/**
 * Result of DocumentDb queries.
 *
 * This is a wrapper around the executeNext method provided by QueryIterator.
 *
 * See http://azure.github.io/azure-documentdb-node/QueryIterator.html
 */
export interface IResultIterator<T> {
  readonly executeNext: () => Promise<
    Either<DocumentDb.QueryError, Option<ReadonlyArray<T>>>
  >;
}

/**
 * Result of DocumentDb queries.
 *
 * This is a wrapper around the executeNext method provided by QueryIterator.
 *
 * See http://azure.github.io/azure-documentdb-node/QueryIterator.html
 */
export interface IFoldableResultIterator<T> {
  readonly executeNext: (
    init: T
  ) => Promise<Either<DocumentDb.QueryError, Option<T>>>;
}

//
// Definition of functions
//

/**
 * Returns the URI for a DocumentDB database
 *
 * @param databaseId The name of the database
 */
export function getDatabaseUri(
  databaseId: NonEmptyString
): IDocumentDbDatabaseUri {
  return {
    databaseId,
    kind: "DocumentDbDatabaseUri",
    uri: DocumentDb.UriFactory.createDatabaseUri(databaseId)
  };
}

/**
 * Returns the URI for a DocumentDB collection
 *
 * @param databaseUri The URI of the database
 * @param collectionId The name of the collection
 */
export function getCollectionUri(
  databaseUri: IDocumentDbDatabaseUri,
  collectionId: string
): IDocumentDbCollectionUri {
  return {
    collectionId,
    databaseUri,
    kind: "DocumentDbCollectionUri",
    uri: DocumentDb.UriFactory.createDocumentCollectionUri(
      databaseUri.databaseId,
      collectionId
    )
  };
}

/**
 * Returns the URi for a DocumentDB document
 *
 * @param collectionUri The URI of the collection
 * @param documentId The ID of the document
 */
export function getDocumentUri(
  collectionUri: IDocumentDbCollectionUri,
  documentId: string
): IDocumentDbDocumentUri {
  return {
    collectionUri,
    documentId,
    kind: "DocumentDbDocumentUri",
    uri: DocumentDb.UriFactory.createDocumentUri(
      collectionUri.databaseUri.databaseId,
      collectionUri.collectionId,
      documentId
    )
  };
}

/**
 * Returns a DatabaseMeta object for a database URL
 *
 * @param client The DocumentDB client
 * @param databaseUrl The database URL
 */
export function readDatabase(
  client: DocumentDb.DocumentClient,
  databaseUri: IDocumentDbDatabaseUri
): Promise<Either<DocumentDb.QueryError, DocumentDb.DatabaseMeta>> {
  return new Promise(resolve => {
    client.readDatabase(databaseUri.uri, (err, result) => {
      if (err) {
        resolve(left<DocumentDb.QueryError, DocumentDb.DatabaseMeta>(err));
      } else {
        resolve(right<DocumentDb.QueryError, DocumentDb.DatabaseMeta>(result));
      }
    });
  });
}

/**
 * Returns a DatabaseMeta object for a database URL
 *
 * @param client The DocumentDB client
 * @param collectionUrl The collection URL
 */
export function readCollection(
  client: DocumentDb.DocumentClient,
  collectionUri: IDocumentDbCollectionUri
): Promise<Either<DocumentDb.QueryError, DocumentDb.CollectionMeta>> {
  return new Promise(resolve => {
    client.readCollection(collectionUri.uri, (err, result) => {
      if (err) {
        resolve(left<DocumentDb.QueryError, DocumentDb.CollectionMeta>(err));
      } else {
        resolve(
          right<DocumentDb.QueryError, DocumentDb.CollectionMeta>(result)
        );
      }
    });
  });
}

/**
 * Creates a new document in a collection
 *
 * @param client The DocumentDB client
 * @param collectionUrl The collection URL
 */
export function createDocument<T>(
  client: DocumentDb.DocumentClient,
  collectionUri: IDocumentDbCollectionUri,
  document: T & DocumentDb.NewDocument,
  partitionKey: string
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise(resolve => {
    client.createDocument(
      collectionUri.uri,
      document,
      {
        partitionKey
      },
      (err, created) => {
        if (err) {
          resolve(
            left<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(err)
          );
        } else {
          resolve(
            right<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(
              created as T & DocumentDb.RetrievedDocument
            )
          );
        }
      }
    );
  });
}

/**
 * Retrieves a document from a collection
 *
 * @param client The DocumentDB client
 * @param documentUrl The document URL
 */
export function readDocument<T>(
  client: DocumentDb.DocumentClient,
  documentUri: IDocumentDbDocumentUri,
  partitionKey: string
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise(resolve => {
    client.readDocument(
      documentUri.uri,
      {
        partitionKey
      },
      (err, result) => {
        if (err) {
          resolve(
            left<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(err)
          );
        } else {
          resolve(
            right<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(
              result as T & DocumentDb.RetrievedDocument
            )
          );
        }
      }
    );
  });
}

/**
 * Wraps executeNext inner QueryIterator method in a Promise
 *
 * Returns an Either:
 *
 *    right(some(RetrievedDocuments)): when documents exists and are correctly retrieved
 *    right(none): in case the iterator haven't found any document
 *    left(QueryError): in case of error querying the database
 */
function executeNext<T>(
  documentIterator: DocumentDb.QueryIterator<DocumentDb.RetrievedDocument>
): Promise<
  Either<
    DocumentDb.QueryError,
    Option<ReadonlyArray<DocumentDb.RetrievedDocument & T>>
  >
> {
  return new Promise(resolve => {
    documentIterator.executeNext((error, documents, _) => {
      if (error) {
        resolve(
          left<
            DocumentDb.QueryError,
            Option<ReadonlyArray<T & DocumentDb.RetrievedDocument>>
          >(error)
        );
      } else if (documents && documents.length > 0) {
        const readonlyDocuments: ReadonlyArray<
          DocumentDb.RetrievedDocument
        > = documents;
        resolve(
          right<
            DocumentDb.QueryError,
            Option<ReadonlyArray<T & DocumentDb.RetrievedDocument>>
          >(
            some(readonlyDocuments as ReadonlyArray<
              T & DocumentDb.RetrievedDocument
            >)
          )
        );
      } else if (!documentIterator.hasMoreResults()) {
        resolve(
          right<
            DocumentDb.QueryError,
            Option<ReadonlyArray<T & DocumentDb.RetrievedDocument>>
          >(none)
        );
      } else {
        resolve(
          right<
            DocumentDb.QueryError,
            Option<ReadonlyArray<T & DocumentDb.RetrievedDocument>>
          >(some([]))
        );
      }
    });
  });
}

/**
 * Queries a collection for documents
 *
 * @param client The DocumentDB client
 * @param collectionUrl The collection URL
 * @param query The query string
 */
export function queryDocuments<T>(
  client: DocumentDb.DocumentClient,
  collectionUri: IDocumentDbCollectionUri,
  query: DocumentDb.DocumentQuery,
  partitionKey: string
): IResultIterator<T & DocumentDb.RetrievedDocument> {
  const documentIterator = client.queryDocuments(collectionUri.uri, query, {
    partitionKey
  });
  return {
    executeNext: () => executeNext<T>(documentIterator)
  };
}

/**
 * Queries a collection for all documents and returns an iterator.
 *
 * @param client The DocumentDB client
 * @param collectionUrl The collection URL
 * @param query The query string
 */
export function readDocuments<T>(
  client: DocumentDb.DocumentClient,
  collectionUri: IDocumentDbCollectionUri
): IResultIterator<T & DocumentDb.RetrievedDocument> {
  const documentIterator = client.readDocuments(collectionUri.uri);
  return {
    executeNext: () => executeNext<T>(documentIterator)
  };
}

/**
 * Queries a collection and returns the first result
 *
 * @param client The DocumentDB client
 * @param collectionUrl The collection URL
 * @param query The query string
 */
export function queryOneDocument<T>(
  client: DocumentDb.DocumentClient,
  collectionUrl: IDocumentDbCollectionUri,
  query: DocumentDb.DocumentQuery,
  partitionKey: string
): Promise<
  Either<DocumentDb.QueryError, Option<T & DocumentDb.RetrievedDocument>>
> {
  // get a result iterator for the query
  const iterator = queryDocuments<T>(
    client,
    collectionUrl,
    query,
    partitionKey
  );
  return new Promise((resolve, reject) => {
    // fetch the first batch of results, since we're looking for just the
    // first result, we should go no further
    iterator.executeNext().then(maybeError => {
      // here we may have a query error or possibly a document, if at
      // least one was found
      maybeError
        .map(maybeDocuments => {
          // it's not an error
          maybeDocuments
            .map(documents => {
              // query resulted in at least a document
              if (documents && documents.length > 0 && documents[0]) {
                // resolve with the first document
                resolve(
                  right<
                    DocumentDb.QueryError,
                    Option<T & DocumentDb.RetrievedDocument>
                  >(some(documents[0]))
                );
              } else {
                // query result was empty
                resolve(
                  right<
                    DocumentDb.QueryError,
                    Option<T & DocumentDb.RetrievedDocument>
                  >(none)
                );
              }
            })
            .getOrElseL(() =>
              resolve(
                right<
                  DocumentDb.QueryError,
                  Option<T & DocumentDb.RetrievedDocument>
                >(none as Option<T & DocumentDb.RetrievedDocument>)
              )
            );
        })
        .mapLeft(error => {
          // it's an error
          resolve(
            left<
              DocumentDb.QueryError,
              Option<T & DocumentDb.RetrievedDocument>
            >(error)
          );
        });
    }, reject);
  });
}

/**
 * Maps a result iterator
 */
export function mapResultIterator<A, B>(
  i: IResultIterator<A>,
  f: (a: A) => B
): IResultIterator<B> {
  return {
    executeNext: () =>
      new Promise((resolve, reject) =>
        i.executeNext().then(errorOrMaybeDocuments => {
          errorOrMaybeDocuments
            .map(maybeDocuments => {
              maybeDocuments
                .map(documents => {
                  if (documents && documents.length > 0) {
                    resolve(
                      right<DocumentDb.QueryError, Option<ReadonlyArray<B>>>(
                        some(documents.map(f))
                      )
                    );
                  } else {
                    resolve(
                      right<DocumentDb.QueryError, Option<ReadonlyArray<B>>>(
                        some([])
                      )
                    );
                  }
                })
                .getOrElseL(() =>
                  resolve(
                    right<DocumentDb.QueryError, Option<ReadonlyArray<B>>>(none)
                  )
                );
            })
            .mapLeft(error =>
              resolve(
                left<DocumentDb.QueryError, Option<ReadonlyArray<B>>>(error)
              )
            );
        }, reject)
      )
  };
}

/**
 * Reduce a result iterator
 */
export function reduceResultIterator<A, B>(
  i: IResultIterator<A>,
  f: (prev: B, curr: A) => B
): IFoldableResultIterator<B> {
  return {
    executeNext: (init: B) =>
      new Promise((resolve, reject) =>
        i.executeNext().then(errorOrMaybeDocuments => {
          errorOrMaybeDocuments
            .map(maybeDocuments => {
              maybeDocuments
                .map(documents => {
                  if (documents && documents.length > 0) {
                    resolve(
                      right<DocumentDb.QueryError, Option<B>>(
                        some(documents.reduce(f, init))
                      )
                    );
                  } else {
                    resolve(
                      right<DocumentDb.QueryError, Option<B>>(some(init))
                    );
                  }
                })
                .getOrElseL(() =>
                  resolve(right<DocumentDb.QueryError, Option<B>>(none))
                );
            })
            .mapLeft(error =>
              resolve(left<DocumentDb.QueryError, Option<B>>(error))
            );
        }, reject)
      )
  };
}

/**
 * Consumes the iterator and returns an arrays with the generated elements
 */
export async function iteratorToArray<T>(
  i: IResultIterator<T>
): Promise<Either<DocumentDb.QueryError, ReadonlyArray<T>>> {
  async function iterate(
    a: ReadonlyArray<T>
  ): Promise<Either<DocumentDb.QueryError, ReadonlyArray<T>>> {
    const errorOrMaybeDocuments = await i.executeNext();
    if (isLeft(errorOrMaybeDocuments)) {
      return left(errorOrMaybeDocuments.value);
    }
    if (isNone(errorOrMaybeDocuments.value)) {
      return right(a);
    }
    const result = errorOrMaybeDocuments.value.value;
    return iterate(a.concat(...result));
  }
  return iterate([]);
}

/**
 * Consumes the iterator and returns the reduced value
 */
export async function iteratorToValue<T>(
  i: IFoldableResultIterator<T>,
  init: T
): Promise<Either<DocumentDb.QueryError, T>> {
  async function iterate(a: T): Promise<Either<DocumentDb.QueryError, T>> {
    const errorOrMaybeResult = await i.executeNext(a);
    if (isLeft(errorOrMaybeResult)) {
      return left(errorOrMaybeResult.value);
    }
    const maybeResult = errorOrMaybeResult.value;
    if (isNone(maybeResult)) {
      return right(a);
    }
    const result = maybeResult.value;
    return iterate(result);
  }
  return iterate(init);
}

/**
 * Replaces an existing document with a new one
 *
 * @param client        The DocumentDB client
 * @param documentUrl   The existing document URL
 * @param document      The new document
 * @param partitionKey  The partitionKey
 */
export function upsertDocument<T>(
  client: DocumentDb.DocumentClient,
  collectionUri: IDocumentDbCollectionUri,
  document: T & DocumentDb.NewDocument,
  partitionKey: string
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise(resolve => {
    client.upsertDocument(
      collectionUri.uri,
      document,
      {
        partitionKey
      },
      /* tslint:disable-next-line:no-identical-functions */
      (err, created) => {
        if (err) {
          resolve(
            left<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(err)
          );
        } else {
          resolve(
            right<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(
              created as T & DocumentDb.RetrievedDocument
            )
          );
        }
      }
    );
  });
}

/**
 * Replaces an existing document with a new one
 *
 * @param client        The DocumentDB client
 * @param documentUrl   The existing document URL
 * @param document      The new document
 * @param partitionKey  The partitionKey
 */
export function replaceDocument<T>(
  client: DocumentDb.DocumentClient,
  documentUri: IDocumentDbDocumentUri,
  document: T & DocumentDb.NewDocument,
  partitionKey: string
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise(resolve => {
    client.replaceDocument(
      documentUri.uri,
      document,
      {
        partitionKey
      },
      /* tslint:disable-next-line:no-identical-functions */
      (err, created) => {
        if (err) {
          resolve(
            left<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(err)
          );
        } else {
          resolve(
            right<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>(
              created as T & DocumentDb.RetrievedDocument
            )
          );
        }
      }
    );
  });
}

///////////// <Attachments>

/**
 * Create or update media attached to a document.
 *
 * @param client        the cosmosdb client
 * @param documentUri   the uri of the document
 * @param attachment    the media (link) to the attachment
 * @param options       request options for the REST API call
 */
export function upsertAttachment<T>(
  client: DocumentDb.DocumentClient,
  documentUri: IDocumentDbDocumentUri,
  attachment: DocumentDb.Attachment,
  options: DocumentDb.RequestOptions = {}
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.AttachmentMeta>> {
  return new Promise(resolve => {
    client.upsertAttachment(
      documentUri.uri,
      attachment,
      options,
      (err, meta) => {
        if (err) {
          resolve(
            left<DocumentDb.QueryError, T & DocumentDb.AttachmentMeta>(err)
          );
        } else {
          resolve(
            right<DocumentDb.QueryError, T & DocumentDb.AttachmentMeta>(
              meta as T & DocumentDb.AttachmentMeta
            )
          );
        }
      }
    );
  });
}

/**
 * Get all media attached to a document.
 *
 * @param client        the cosmosdb client
 * @param documentUri   the uri of the document
 * @param options       request options for the REST API call
 */
export function queryAttachments<T>(
  client: DocumentDb.DocumentClient,
  documentUri: IDocumentDbDocumentUri,
  options: DocumentDb.FeedOptions
): IResultIterator<T & DocumentDb.AttachmentMeta> {
  const attachmentsIterator = client.readAttachments(documentUri.uri, options);
  return {
    executeNext: () => {
      return new Promise(resolve => {
        attachmentsIterator.executeNext((error, attachments, _) => {
          if (error) {
            resolve(
              left<
                DocumentDb.QueryError,
                Option<ReadonlyArray<T & DocumentDb.AttachmentMeta>>
              >(error)
            );
          } else if (attachments && attachments.length > 0) {
            const readonlyAttachments: ReadonlyArray<
              DocumentDb.AttachmentMeta
            > = attachments;
            resolve(
              right<
                DocumentDb.QueryError,
                Option<ReadonlyArray<T & DocumentDb.AttachmentMeta>>
              >(
                some(readonlyAttachments as ReadonlyArray<
                  T & DocumentDb.AttachmentMeta
                >)
              )
            );
          } else {
            resolve(
              right<
                DocumentDb.QueryError,
                Option<ReadonlyArray<T & DocumentDb.AttachmentMeta>>
              >(none)
            );
          }
        });
      });
    }
  };
}

///////////// </Attachments>
