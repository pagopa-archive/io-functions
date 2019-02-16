/* tslint:disable:no-any */
/* tslint:disable:no-duplicate-string */

import { NonEmptyString } from "io-ts-commons/lib/strings";

import * as DocumentDb from "documentdb";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import * as DocumentDbUtils from "../documentdb";

describe("getDatabaseUri", () => {
  it("should generate a database Uri", () => {
    expect(
      DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString).uri
    ).toEqual("dbs/mydb");
  });
});

describe("getCollectionUri", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);

  it("should generate a collection Uri", () => {
    expect(
      DocumentDbUtils.getCollectionUri(dbUriFixture, "mycoll").uri
    ).toEqual("dbs/mydb/colls/mycoll");
  });
});

describe("readDatabase", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const dbFixture = {} as DocumentDb.DatabaseMeta;

  it("should resolve a promise with the database", async () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb(undefined, dbFixture))
    };
    const result = await DocumentDbUtils.readDatabase(
      (clientMock as any) as DocumentDb.DocumentClient,
      dbUriFixture
    );
    expect(clientMock.readDatabase).toHaveBeenCalledTimes(1);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(dbFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readDatabase: jest.fn((_, cb) => cb("error"))
    };
    const result = await DocumentDbUtils.readDatabase(
      (clientMock as any) as DocumentDb.DocumentClient,
      dbUriFixture
    );
    expect(clientMock.readDatabase).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("readCollection", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );
  const collectionFixture = {} as DocumentDb.CollectionMeta;

  it("should resolve a promise with the collection", async () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb(undefined, collectionFixture))
    };
    const result = await DocumentDbUtils.readCollection(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture
    );
    expect(clientMock.readCollection).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(collectionFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readCollection: jest.fn((_, cb) => cb("error"))
    };
    const result = await DocumentDbUtils.readCollection(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture
    );
    expect(clientMock.readCollection).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("createDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );
  const documentFixture = {} as DocumentDb.NewDocument;

  it("should resolve a promise with the created document", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, documentFixture)
      )
    };
    const result = await DocumentDbUtils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      documentFixture,
      "fiscalCode"
    );
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(documentFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };
    const result = await DocumentDbUtils.createDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      documentFixture,
      "fiscalCode"
    );
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("upsertDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );
  const documentFixture = {} as DocumentDb.NewDocument;

  it("should resolve a promise with the upserted document", async () => {
    const clientMock = {
      upsertDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, documentFixture)
      )
    };
    const result = await DocumentDbUtils.upsertDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      documentFixture,
      "fiscalCode"
    );
    expect(clientMock.upsertDocument).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(documentFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      upsertDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };
    const result = await DocumentDbUtils.upsertDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      documentFixture,
      "fiscalCode"
    );
    expect(clientMock.upsertDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("readDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );
  const documentUriFixture = DocumentDbUtils.getDocumentUri(
    collectionUriFixture,
    "mydoc"
  );
  const documentFixture = {} as DocumentDb.RetrievedDocument;

  it("should resolve a promise with the created document (single partition key)", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb(undefined, documentFixture))
    };
    const result = await DocumentDbUtils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUriFixture,
      "k"
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: "k"
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(documentFixture);
    }
  });

  it("should reject a promise with the error", async () => {
    const clientMock = {
      readDocument: jest.fn((__, ___, cb) => cb("error"))
    };
    const result = await DocumentDbUtils.readDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      documentUriFixture,
      "k"
    );
    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("queryDocuments", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );

  it("should return an iterator for the results of the query and iterate over values", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, ["result"], undefined))
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };
    const iterator = DocumentDbUtils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
      "PARTITIONKEY"
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(
      collectionUriFixture.uri,
      "QUERY",
      { partitionKey: "PARTITIONKEY" }
    );
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(["result"]);
    }
  });

  it("should return an iterator for the results of the query and reject the promise on failure", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb("error", undefined, undefined))
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };
    const iterator = DocumentDbUtils.queryDocuments(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
      "PARTITIONKEY"
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(
      collectionUriFixture.uri,
      "QUERY",
      { partitionKey: "PARTITIONKEY" }
    );
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("queryOneDocument", () => {
  const dbUriFixture = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const collectionUriFixture = DocumentDbUtils.getCollectionUri(
    dbUriFixture,
    "mycollection"
  );

  it("should resolve a promise to the first result of the query", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb =>
        cb(undefined, ["result1", "result2"], undefined)
      )
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
      "PARTITIONKEY"
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(
      collectionUriFixture.uri,
      "QUERY",
      { partitionKey: "PARTITIONKEY" }
    );
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual("result1");
    }
  });

  it("should resolve a promise to null if the query has no results", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined)),
      hasMoreResults: jest.fn().mockReturnValue(false)
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
      "PARTITIONKEY"
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(
      collectionUriFixture.uri,
      "QUERY",
      { partitionKey: "PARTITIONKEY" }
    );
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should reject a promise if the query has errors", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb("error", undefined, undefined))
    };
    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };
    const result = await DocumentDbUtils.queryOneDocument(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUriFixture,
      "QUERY",
      "PARTITIONKEY"
    );
    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
    expect(clientMock.queryDocuments).toBeCalledWith(
      collectionUriFixture.uri,
      "QUERY",
      { partitionKey: "PARTITIONKEY" }
    );
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("mapResultIterator", () => {
  it("should map the documents of the wrapped iterator", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };

    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([1, 2])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const mappedIterator = DocumentDbUtils.mapResultIterator(
      iteratorMock as any,
      (n: number) => n * 2
    );

    const result1 = await mappedIterator.executeNext();
    await mappedIterator.executeNext();

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(2);
    expect(isRight(result1)).toBeTruthy();
    if (isRight(result1)) {
      expect(result1.value.isSome());
      expect(result1.value.toUndefined()).toEqual([2, 4]);
    }
    expect(isRight(result1)).toBeTruthy();
    if (isRight(result1)) {
      expect(result1.value.isNone());
    }
  });
});

describe("iteratorToArray", () => {
  it("should consume an iterator", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };

    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([1, 2])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([3, 4])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const result = await DocumentDbUtils.iteratorToArray(iteratorMock);

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(3);
    expect(result).toEqual(right([1, 2, 3, 4]));
  });
  it("should fail in case of query error", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };
    const queryError = {
      body: "too many requests",
      code: 429
    };

    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([1, 2])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(left(queryError))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([3, 4])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const result = await DocumentDbUtils.iteratorToArray(iteratorMock);

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(2);
    expect(result).toEqual(left(queryError));
  });
});

/////////////////////////////////

describe("reduceResultIterator", () => {
  it("should reduce the documents of the wrapped iterator", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };

    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some(["1", "2"])))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const reduceIterator = DocumentDbUtils.reduceResultIterator(
      iteratorMock as any,
      (prev: string, cur: string) => prev + cur
    );

    const result1 = await reduceIterator.executeNext("");
    result1.map(r => r.map(async o => await reduceIterator.executeNext(o)));

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(2);
    expect(isRight(result1)).toBeTruthy();
    if (isRight(result1)) {
      expect(result1.value.isSome());
      expect(result1.value.toUndefined()).toEqual("12");
    }
    expect(isRight(result1)).toBeTruthy();
    if (isRight(result1)) {
      expect(result1.value.isNone());
    }
  });
});

describe("iteratorToValue", () => {
  it("should reduce an iterator into a value", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };

    iteratorMock.executeNext.mockImplementationOnce(init =>
      Promise.resolve(right(some(init.concat("1"))))
    );
    iteratorMock.executeNext.mockImplementationOnce(init =>
      Promise.resolve(right(some(init.concat("2"))))
    );
    iteratorMock.executeNext.mockImplementationOnce(_ =>
      Promise.resolve(right(none))
    );

    const result = await DocumentDbUtils.iteratorToValue(iteratorMock, "");

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(3);
    expect(result).toEqual(right("12"));
  });
  it("should fail in case of query error", async () => {
    const iteratorMock = {
      executeNext: jest.fn()
    };
    const queryError = {
      body: "too many requests",
      code: 429
    };

    iteratorMock.executeNext.mockImplementationOnce(init =>
      Promise.resolve(right(some(init.concat("1"))))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(left(queryError))
    );
    iteratorMock.executeNext.mockImplementationOnce(init =>
      Promise.resolve(right(some(init.concat("2"))))
    );
    iteratorMock.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const result = await DocumentDbUtils.iteratorToValue(iteratorMock, "");

    expect(iteratorMock.executeNext).toHaveBeenCalledTimes(2);
    expect(result).toEqual(left(queryError));
  });
});

/////////////////////////////////

describe("upsertAttachment", () => {
  const aDbUri = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const aCollectionUri = DocumentDbUtils.getCollectionUri(
    aDbUri,
    "mycollection"
  );
  const aDocumentUri = DocumentDbUtils.getDocumentUri(aCollectionUri, "mydoc");
  it("should link an attachment to the document", async () => {
    const anAttachment = {
      _self: "",
      _ts: "",
      contentType: "application/json",
      id: "",
      media: "https://www.example.com"
    };
    const clientMock = {
      upsertAttachment: jest.fn((_, __, ___, cb) => cb(undefined, anAttachment))
    };
    const result = await DocumentDbUtils.upsertAttachment(
      (clientMock as any) as DocumentDb.DocumentClient,
      aDocumentUri,
      anAttachment
    );
    expect(clientMock.upsertAttachment).toHaveBeenCalledTimes(1);
    expect(clientMock.upsertAttachment).toBeCalledWith(
      aDocumentUri.uri,
      anAttachment,
      {},
      expect.any(Function)
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(anAttachment);
    }
  });
});

describe("queryAttachments", () => {
  const aDbUri = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
  const aCollectionUri = DocumentDbUtils.getCollectionUri(
    aDbUri,
    "mycollection"
  );
  const aDocumentUri = DocumentDbUtils.getDocumentUri(aCollectionUri, "mydoc");
  const someFeedOptions = { maxItemCount: 10000000 };
  it("should return an iterator for the attachments", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, ["result"], undefined))
    };
    const clientMock = {
      readAttachments: jest.fn((__, ___) => iteratorMock)
    };
    const iterator = DocumentDbUtils.queryAttachments(
      (clientMock as any) as DocumentDb.DocumentClient,
      aDocumentUri,
      someFeedOptions
    );
    expect(clientMock.readAttachments).toHaveBeenCalledTimes(1);
    expect(clientMock.readAttachments).toBeCalledWith(
      aDocumentUri.uri,
      someFeedOptions
    );
    const result = await iterator.executeNext();
    expect(iteratorMock.executeNext).toBeCalled();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(["result"]);
    }
  });
});
