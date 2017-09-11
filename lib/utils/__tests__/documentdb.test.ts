// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import { none, some } from "ts-option";

import * as DocumentDbUtils from "../documentdb";
import { left, right } from "../either";

describe("getDatabaseUri", () => {

  it("should generate a database Uri", () => {
    expect(DocumentDbUtils.getDatabaseUri("mydb").uri).toEqual("dbs/mydb");
  });

});

describe("getCollectionUri", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");

  it("should generate a collection Uri", () => {
    expect(DocumentDbUtils.getCollectionUri(dbUriFixture, "mycoll").uri).toEqual("dbs/mydb/colls/mycoll");
  });

});

describe("readDatabase", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const dbFixture = {} as DocumentDb.DatabaseMeta;

  it("should resolve a promise with the database", async () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb(undefined, dbFixture)),
    };
    const result = await DocumentDbUtils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUriFixture);
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
    const result = await DocumentDbUtils.readDatabase((clientMock as any) as DocumentDb.DocumentClient, dbUriFixture);
    expect(clientMock.readDatabase).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("readCollection", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(dbUriFixture, "mycollection");
  const collectionFixture = {} as DocumentDb.CollectionMeta;

  it("should resolve a promise with the collection", async () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb(undefined, collectionFixture)),
    };
    const result = await DocumentDbUtils.readCollection(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
    );
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
    const result = await DocumentDbUtils.readCollection(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
    );
    expect(clientMock.readCollection).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("createDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(dbUriFixture, "mycollection");
  const documentFixture = {} as DocumentDb.NewDocument;

  it("should resolve a promise with the created document", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await DocumentDbUtils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
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
    const result = await DocumentDbUtils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
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
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(dbUriFixture, "mycollection");
  const documentUriFixture = DocumentDbUtils.getDocumentUri(collectionUriFixture, "mydoc");
  const documentFixture = {} as DocumentDb.RetrievedDocument;

  it("should resolve a promise with the created document (single partition key)", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await DocumentDbUtils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUriFixture,
      "k",
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: "k" });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(documentFixture);
    }
  });

  /*
  it("should resolve a promise with the created document (composite partition key)", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(undefined, documentFixture)),
    };
    const result = await DocumentDbUtils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUriFixture,
      [ "k1", "k2" ],
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({ partitionKey: [ "k1", "k2" ] });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(documentFixture);
    }
  });
  */

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb("error")),
    };
    const result = await DocumentDbUtils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUriFixture,
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
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(dbUriFixture, "mycollection");

  it("should return an iterator for the results of the query and iterate over values", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result" ], undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const iterator = await DocumentDbUtils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUriFixture.uri, "QUERY");
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
    const iterator = await DocumentDbUtils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUriFixture.uri, "QUERY");
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("queryOneDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb");
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(dbUriFixture, "mycollection");

  it("should resolve a promise to the first result of the query", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result1", "result2" ], undefined)),
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUriFixture.uri, "QUERY");
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
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUriFixture.uri, "QUERY");
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
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(collectionUriFixture.uri, "QUERY");
    expect(iteratorMock.executeNext).toBeCalled();
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("mapResultIterator", () => {

  it("should map the documents or the wrapped iterator", async () => {

    const iteratorMock = {
      executeNext: jest.fn(),
    };

    iteratorMock.executeNext.mockImplementationOnce(() => Promise.resolve(right(some([1, 2]))));
    iteratorMock.executeNext.mockImplementationOnce(() => Promise.resolve(right(none)));

    const mappedIterator = DocumentDbUtils.mapResultIterator(iteratorMock as any, (n: number) => n * 2);

    const result1 = await mappedIterator.executeNext();
    const result2 = await mappedIterator.executeNext();

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(2);
    expect(result1.isRight).toBeTruthy();
    if (result1.isRight) {
      expect(result1.right.isDefined);
      expect(result1.right.get).toEqual([2, 4]);
    }
    expect(result1.isRight).toBeTruthy();
    if (result1.isRight) {
      expect(result1.right.isEmpty);
    }
  });

});

describe("iteratorToArray", () => {

  it("should consume an iterator", async () => {
    const iteratorMock = {
      executeNext: jest.fn(),
    };

    iteratorMock.executeNext.mockImplementationOnce(() => Promise.resolve(right(some([1, 2]))));
    iteratorMock.executeNext.mockImplementationOnce(() => Promise.resolve(right(some([3, 4]))));
    iteratorMock.executeNext.mockImplementationOnce(() => Promise.resolve(right(none)));

    const result = await DocumentDbUtils.iteratorToArray(iteratorMock);

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(3);
    expect(result).toEqual([1, 2, 3, 4]);
  });

});
