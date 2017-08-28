// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as Utils from "../documentdb";

describe("getDatabaseUrl", () => {

  it("should generate a database URL", () => {
    expect(Utils.getDatabaseUrl("mydb")).toEqual("dbs/mydb");
  });

});

describe("getCollectionUrl", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");

  it("should generate a collection URL", () => {
    expect(Utils.getCollectionUrl(dbUrlFixture, "mycoll")).toEqual("dbs/mydb/colls/mycoll");
  });

});

describe("readDatabase", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const dbFixture = {} as DocumentDb.DatabaseMeta;

  it("should resolve a promise with the database", () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb(null, dbFixture)),
    };
    const promise = Utils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUrlFixture);
    expect(clientMock.readDatabase.mock.calls.length).toEqual(1);
    return expect(promise).resolves.toEqual(dbFixture);
  });

  it("should reject a promise with the error", () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb("error")),
    };
    const promise = Utils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUrlFixture);
    expect(clientMock.readDatabase.mock.calls.length).toEqual(1);
    return expect(promise).rejects.toEqual("error");
  });

});

describe("readCollection", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const collectionFixture = {} as DocumentDb.CollectionMeta;

  it("should resolve a promise with the collection", () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb(null, collectionFixture)),
    };
    const promise = Utils.readCollection((clientMock as any) as DocumentDb.DocumentClient, collectionUrlFixture);
    expect(clientMock.readCollection.mock.calls.length).toEqual(1);
    return expect(promise).resolves.toEqual(collectionFixture);
  });

  it("should reject a promise with the error", () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb("error")),
    };
    const promise = Utils.readCollection((clientMock as any) as DocumentDb.DocumentClient, collectionUrlFixture);
    expect(clientMock.readCollection.mock.calls.length).toEqual(1);
    return expect(promise).rejects.toEqual("error");
  });

});

describe("createDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const documentFixture = {} as DocumentDb.NewDocument;

  it("should resolve a promise with the created document", () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(null, documentFixture)),
    };
    const promise = Utils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      documentFixture,
      "fiscalCode",
    );
    expect(clientMock.createDocument.mock.calls.length).toEqual(1);
    return expect(promise).resolves.toEqual(documentFixture);
  });

  it("should reject a promise with the error", () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };
    const promise = Utils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      documentFixture,
      "fiscalCode",
    );
    expect(clientMock.createDocument.mock.calls.length).toEqual(1);
    return expect(promise).rejects.toEqual("error");
  });

});

describe("readDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const documentUrlFixture = Utils.getDocumentUrl(collectionUrlFixture, "mydoc");
  const documentFixture = {} as DocumentDb.RetrievedDocument;

  it("should resolve a promise with the created document (single partition key)", () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(null, documentFixture)),
    };
    const promise = Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      "k",
    );
    expect(clientMock.readDocument.mock.calls.length).toEqual(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: "k" });
    return expect(promise).resolves.toEqual(documentFixture);
  });

  it("should resolve a promise with the created document (composite partition key)", () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(null, documentFixture)),
    };
    const promise = Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      [ "k1", "k2" ],
    );
    expect(clientMock.readDocument.mock.calls.length).toEqual(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: [ "k1", "k2" ] });
    return expect(promise).resolves.toEqual(documentFixture);
  });

  it("should reject a promise with the error", () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb("error")),
    };
    const promise = Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      "k",
    );
    expect(clientMock.readDocument.mock.calls.length).toEqual(1);
    return expect(promise).rejects.toEqual("error");
  });

});

describe("queryDocuments", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");

  it("should return an iterator for the results of the query and iterate over values", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, "result", null)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const iterator = Utils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments.mock.calls.length).toEqual(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    const promise = iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    return expect(promise).resolves.toEqual("result");
  });

  it("should return an iterator for the results of the query and reject the promise on failure", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb("error", null, null)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const iterator = Utils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments.mock.calls.length).toEqual(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    const promise = iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    return expect(promise).rejects.toEqual("error");
  });

});

describe("queryOneDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");

  it("should resolve a promise to the first result of the query", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ "result1", "result2" ], null)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const promise = Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments.mock.calls.length).toEqual(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    return expect(promise).resolves.toEqual("result1");
  });

  it("should resolve a promise to null if the query has no results", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ ], null)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const promise = Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments.mock.calls.length).toEqual(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    return expect(promise).resolves.toEqual(null);
  });

  it("should reject a promise if the query has errors", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb("error", null, null)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const promise = Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments.mock.calls.length).toEqual(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    return expect(promise).rejects.toEqual("error");
  });

});
