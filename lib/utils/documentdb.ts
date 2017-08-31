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

export interface IResultIterator<T> {
  readonly executeNext: () => Promise<T>;
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
): Promise<DocumentDb.DatabaseMeta> {
  return new Promise((resolve, reject) => {
    client.readDatabase(databaseUrl, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
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
): Promise<DocumentDb.CollectionMeta> {
  return new Promise((resolve, reject) => {
    client.readCollection(collectionUrl, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
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
  partitionKey: string | ReadonlyArray<string>,
): Promise<T & DocumentDb.RetrievedDocument> {
  return new Promise((resolve, reject) => {
    client.createDocument(collectionUrl, document, {
      partitionKey,
    }, (err, created) => {
      if (err) {
        reject(err);
      } else {
        resolve(created as T & DocumentDb.RetrievedDocument);
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
  partitionKey: string | ReadonlyArray<string>,
): Promise<T & DocumentDb.RetrievedDocument> {
  return new Promise((resolve, reject) => {
    client.readDocument(documentUrl, {
      partitionKey,
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result as T & DocumentDb.RetrievedDocument);
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
): IResultIterator<ReadonlyArray<T & DocumentDb.RetrievedDocument>> {
  const documentIterator = client.queryDocuments(collectionUrl, query);
  const resultIterator: IResultIterator<ReadonlyArray<T & DocumentDb.RetrievedDocument>> = {
    executeNext: () => {
      return new Promise((resolve, reject) => {
        documentIterator.executeNext((error, resource, _) => {
          if (error) {
            reject(error);
          } else {
            resolve(resource as ReadonlyArray<T & DocumentDb.RetrievedDocument>);
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
): Promise<T | null> {
  const iterator = queryDocuments<T>(client, collectionUrl, query);
  return new Promise((resolve, reject) => {
    iterator.executeNext().then(
      (result) => {
        if (result != null && result.length > 0) {
          resolve(result[0]);
        } else {
          resolve(null);
        }
      },
      (error) => reject(error),
    );
  });
}
