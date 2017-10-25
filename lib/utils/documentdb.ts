/*
 * Utility functions for interacting with DocumentDB
 *
 * These are mostly typesafe/async wrappers around methods
 * of the DocumentDb SDK.
 *
 * See http://azure.github.io/azure-documentdb-node/DocumentClient.html
 *
 */

import * as DocumentDb from "documentdb";

import { none, Option, some } from "ts-option";

import { Either, left, right } from "./either";

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

//
// Definition of functions
//

/**
 * Returns the URI for a DocumentDB database
 *
 * @param databaseId The name of the database
 */
export function getDatabaseUri(databaseId: string): IDocumentDbDatabaseUri {
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
        resolve(left(err));
      } else {
        resolve(right(result));
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
        resolve(left(err));
      } else {
        resolve(right(result));
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
          resolve(left(err));
        } else {
          resolve(right(created as T & DocumentDb.RetrievedDocument));
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
          resolve(left(err));
        } else {
          resolve(right(result as T & DocumentDb.RetrievedDocument));
        }
      }
    );
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
  query: DocumentDb.DocumentQuery
): IResultIterator<T & DocumentDb.RetrievedDocument> {
  const documentIterator = client.queryDocuments(collectionUri.uri, query, {
    // enableCrossPartitionQuery is mandatory if you want to query for fields
    // other than the partitionKey and Id
    enableCrossPartitionQuery: true
  });
  const resultIterator: IResultIterator<T & DocumentDb.RetrievedDocument> = {
    executeNext: () => {
      return new Promise(resolve => {
        documentIterator.executeNext((error, documents, _) => {
          if (error) {
            resolve(left(error));
          } else if (documents && documents.length > 0) {
            const readonlyDocuments: ReadonlyArray<
              DocumentDb.RetrievedDocument
            > = documents;
            resolve(
              right(
                some(readonlyDocuments as ReadonlyArray<
                  T & DocumentDb.RetrievedDocument
                >)
              )
            );
          } else {
            resolve(right(none));
          }
        });
      });
    }
  };
  return resultIterator;
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
  query: DocumentDb.DocumentQuery
): Promise<Either<DocumentDb.QueryError, Option<T>>> {
  // get a result iterator for the query
  const iterator = queryDocuments<T>(client, collectionUrl, query);
  return new Promise((resolve, reject) => {
    // fetch the first batch of results, since we're looking for just the
    // first result, we should go no further
    iterator.executeNext().then(maybeError => {
      // here we may have a query error or possibly a document, if at
      // least one was found
      maybeError
        .mapRight(maybeDocuments => {
          // it's not an error
          maybeDocuments
            .map(documents => {
              // query resulted in at least a document
              if (documents && documents.length > 0 && documents[0]) {
                // resolve with the first document
                resolve(right(some(documents[0])));
              } else {
                // query result was empty
                resolve(right(none));
              }
            })
            .getOrElse(() => {
              resolve(right(none as Option<T>));
            });
        })
        .mapLeft(error => {
          // it's an error
          resolve(left(error));
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
            .mapRight(maybeDocuments => {
              maybeDocuments
                .map(documents => {
                  if (documents && documents.length > 0) {
                    resolve(right(some(documents.map(f))));
                  } else {
                    resolve(right(none));
                  }
                })
                .getOrElse(() => resolve(right(none)));
            })
            .mapLeft(error => resolve(left(error)));
        }, reject)
      )
  };
}

/**
 * Consumes the iterator and returns an arrays with the generated elements
 */
export async function iteratorToArray<T>(
  i: IResultIterator<T>
): Promise<ReadonlyArray<T>> {
  async function iterate(a: ReadonlyArray<T>): Promise<ReadonlyArray<T>> {
    const errorOrMaybeDocuments = await i.executeNext();
    if (
      errorOrMaybeDocuments.isLeft ||
      errorOrMaybeDocuments.right.isEmpty ||
      errorOrMaybeDocuments.right.get.length === 0
    ) {
      return a;
    }
    const result = errorOrMaybeDocuments.right.get;
    return iterate(a.concat(...result));
  }
  return iterate([]);
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
      (err, created) => {
        if (err) {
          resolve(left(err));
        } else {
          resolve(right(created as T & DocumentDb.RetrievedDocument));
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
          resolve(left(err));
        } else {
          resolve(right(meta as T & DocumentDb.AttachmentMeta));
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
  options: DocumentDb.FeedOptions = {}
): IResultIterator<T & DocumentDb.AttachmentMeta> {
  const attachmentsIterator = client.readAttachments(documentUri.uri, options);
  const resultIterator: IResultIterator<T & DocumentDb.AttachmentMeta> = {
    executeNext: () => {
      return new Promise(resolve => {
        attachmentsIterator.executeNext((error, attachments, _) => {
          if (error) {
            resolve(left(error));
          } else if (attachments && attachments.length > 0) {
            const readonlyAttachments: ReadonlyArray<
              DocumentDb.AttachmentMeta
            > = attachments;
            resolve(
              right(
                some(readonlyAttachments as ReadonlyArray<
                  T & DocumentDb.AttachmentMeta
                >)
              )
            );
          } else {
            resolve(right(none));
          }
        });
      });
    }
  };
  return resultIterator;
}

///////////// </Attachments>
