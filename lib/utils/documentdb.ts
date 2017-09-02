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

// tslint:disable-next-line:max-classes-per-file
declare class DocumentDbDatabaseUrlTag {
  private dummy: boolean;
}

export type DocumentDbDatabaseUrl = string & DocumentDbDatabaseUrlTag;

// tslint:disable-next-line:max-classes-per-file
declare class DocumentDbCollectionUrlTag {
  private dummy: boolean;
}

export type DocumentDbCollectionUrl = string & DocumentDbCollectionUrlTag;

// tslint:disable-next-line:max-classes-per-file
declare class DocumentDbDocumentUrlTag {
  private dummy: boolean;
}

export type DocumentDbDocumentUrl = string & DocumentDbDocumentUrlTag;

/**
 * Result of DocumentDb queries.
 *
 * This is a wrapper around the executeNext method provided by QueryIterator.
 *
 * See http://azure.github.io/azure-documentdb-node/QueryIterator.html
 */
export interface IResultIterator<T> {
  readonly executeNext: () => Promise<Either<DocumentDb.QueryError, Option<ReadonlyArray<T>>>>;
}

//
// Definition of functions
//

/**
 * Returns the URL for a DocumentDB database
 *
 * @param databaseName The name of the database
 */
export function getDatabaseUrl(databaseName: string): DocumentDbDatabaseUrl {
  return `dbs/${databaseName}` as DocumentDbDatabaseUrl;
}

/**
 * Returns the URL for a DocumentDB collection
 *
 * @param databaseUrl The URL of the database
 * @param collectionName The name of the collection
 */
export function getCollectionUrl(databaseUrl: DocumentDbDatabaseUrl, collectionName: string): DocumentDbCollectionUrl {
  return `${databaseUrl}/colls/${collectionName}` as DocumentDbCollectionUrl;
}

/**
 * Returns the URL for a DocumentDB document
 *
 * @param collectionUrl The URL of the collection
 * @param documentId The ID of the document
 */
export function getDocumentUrl(collectionUrl: DocumentDbCollectionUrl, documentId: string): DocumentDbDocumentUrl {
  return `${collectionUrl}/docs/${documentId}` as DocumentDbDocumentUrl;
}

/**
 * Returns a DatabaseMeta object for a database URL
 *
 * @param client The DocumentDB client
 * @param databaseUrl The database URL
 */
export function readDatabase(
  client: DocumentDb.DocumentClient,
  databaseUrl: DocumentDbDatabaseUrl,
): Promise<Either<DocumentDb.QueryError, DocumentDb.DatabaseMeta>> {
  return new Promise((resolve) => {
    client.readDatabase(databaseUrl, (err, result) => {
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
  collectionUrl: DocumentDbCollectionUrl,
): Promise<Either<DocumentDb.QueryError, DocumentDb.CollectionMeta>> {
  return new Promise((resolve) => {
    client.readCollection(collectionUrl, (err, result) => {
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
  collectionUrl: DocumentDbCollectionUrl,
  document: T & DocumentDb.NewDocument,
  // tslint:disable-next-line:readonly-array
  partitionKey: string | string[],
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise((resolve) => {
    client.createDocument(collectionUrl, document, {
      partitionKey,
    }, (err, created) => {
      if (err) {
        resolve(left(err));
      } else {
        resolve(right(created as T & DocumentDb.RetrievedDocument));
      }
    });
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
  documentUrl: DocumentDbDocumentUrl,
  // tslint:disable-next-line:readonly-array
  partitionKey: string | string[],
): Promise<Either<DocumentDb.QueryError, T & DocumentDb.RetrievedDocument>> {
  return new Promise((resolve) => {
    client.readDocument(documentUrl, {
      partitionKey,
    }, (err, result) => {
      if (err) {
        resolve(left(err));
      } else {
        resolve(right(result as T & DocumentDb.RetrievedDocument));
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
  collectionUrl: DocumentDbCollectionUrl,
  query: DocumentDb.DocumentQuery,
): IResultIterator<T & DocumentDb.RetrievedDocument> {
  const documentIterator = client.queryDocuments(collectionUrl, query);
  const resultIterator: IResultIterator<T & DocumentDb.RetrievedDocument> = {
    executeNext: () => {
      return new Promise((resolve) => {
        documentIterator.executeNext((error, documents, _) => {
          if (error) {
            resolve(left(error));
          } else if (documents && documents.length > 0) {
            const readonlyDocuments: ReadonlyArray<DocumentDb.RetrievedDocument> = documents;
            resolve(right(some(readonlyDocuments as ReadonlyArray<T & DocumentDb.RetrievedDocument>)));
          } else {
            resolve(right(none));
          }
        });
      });
    },
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
  collectionUrl: DocumentDbCollectionUrl,
  query: DocumentDb.DocumentQuery,
): Promise<Either<DocumentDb.QueryError, Option<T>>> {
  // get a result iterator for the query
  const iterator = queryDocuments<T>(client, collectionUrl, query);
  return new Promise((resolve, reject) => {
    // fetch the first batch of results, since we're looking for just the
    // first result, we should go no further
    iterator.executeNext().then(
      (maybeError) => {
        // here we may have a query error or possibly a document, if at
        // least one was found
        maybeError.mapRight((maybeDocuments) => {
          // it's not an error
          maybeDocuments.map((documents) => {
            // query resulted in at least a document
            if (documents && documents.length > 0 && documents[0]) {
              // resolve with the first document
              resolve(right(some(documents[0])));
            } else {
              // query result was empty
              resolve(right(none));
            }
          }).getOrElse(() => {
            resolve(right(none as Option<T>));
          });
        }).mapLeft((error) => {
          // it's an error
          resolve(left(error));
        });
      },
      reject,
    );
  });
}

/**
 * Maps a result iterator
 */
export function mapResultIterator<A, B>(i: IResultIterator<A>, f: (a: A) => B): IResultIterator<B> {
  return {
    executeNext: () => new Promise((resolve, reject) => i.executeNext().then(
      (maybeError) => {
        maybeError.mapRight((maybeDocuments) => {
          maybeDocuments.map((documents) => {
            if (documents && documents.length > 0) {
              resolve(right(some(documents.map(f))));
            } else {
              resolve(right(none));
            }
          }).getOrElse(() => resolve(right(none)));
        }).mapLeft((error) => resolve(left(error)));
      }, reject)),
  };
}
