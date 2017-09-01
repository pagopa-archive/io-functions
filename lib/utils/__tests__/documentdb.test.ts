// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as Utils from "../documentdb";
import { left, right } from "../either";

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

  it("should resolve a promise with the database", async () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb(undefined, dbFixture)),
    };
    const result = await Utils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUrlFixture);
    expect(clientMock.readDatabase).toHaveBeenCalledTimes(1);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(dbFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb("error")),
    };
    const result = await Utils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUrlFixture);
    expect(clientMock.readDatabase).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("readCollection", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const collectionFixture = {} as DocumentDb.CollectionMeta;

  it("should resolve a promise with the collection", async () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb(undefined, collectionFixture)),
    };
    const result = await Utils.readCollection((clientMock as any) as DocumentDb.DocumentClient, collectionUrlFixture);
    expect(clientMock.readCollection).toHaveBeenCalledTimes(1);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(collectionFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb("error")),
    };
    const result = await Utils.readCollection((clientMock as any) as DocumentDb.DocumentClient, collectionUrlFixture);
    expect(clientMock.readCollection).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("createDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const documentFixture = {} as DocumentDb.NewDocument;

  it("should resolve a promise with the created document", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await Utils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      documentFixture,
      "fiscalCode",
    );
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(documentFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };
    const result = await Utils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      documentFixture,
      "fiscalCode",
    );
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("readDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");
  const documentUrlFixture = Utils.getDocumentUrl(collectionUrlFixture, "mydoc");
  const documentFixture = {} as DocumentDb.RetrievedDocument;

  it("should resolve a promise with the created document (single partition key)", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      "k",
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: "k" });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(documentFixture);
    }
  });

  it("should resolve a promise with the created document (composite partition key)", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      [ "k1", "k2" ],
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: [ "k1", "k2" ] });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(documentFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb("error")),
    };
    const result = await Utils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUrlFixture,
      "k",
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("queryDocuments", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");

  it("should return an iterator for the results of the query and iterate over values", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result" ], undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const iterator = await Utils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(["result"]);
    }
  });

  it("should return an iterator for the results of the query and reject the promise on failure", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb("error", undefined, undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const iterator = await Utils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("queryOneDocument", () => {
  const dbUrlFixture = Utils.getDatabaseUrl("mydb");
  const collectionUrlFixture = Utils.getCollectionUrl(dbUrlFixture, "mycollection");

  it("should resolve a promise to the first result of the query", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result1", "result2" ], undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const result = await Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual("result1");
    }
  });

  it("should resolve a promise to null if the query has no results", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ ], undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const result = await Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

  it("should reject a promise if the query has errors", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb("error", undefined, undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const result = await Utils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrlFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUrlFixture, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});
