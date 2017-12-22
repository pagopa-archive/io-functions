// tslint:disable:no-object-mutation
// tslint:disable:no-any
import { NonEmptyString } from "../strings";

import * as DocumentDb from "documentdb";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";

import { DocumentDbModel } from "../documentdb_model";

interface IMyDocument {
  readonly test: string;
}

interface INewMyDocument extends IMyDocument, DocumentDb.NewDocument {
  readonly kind: "INewMyDocument";
}

interface IRetrievedMyDocument
  extends IMyDocument,
    DocumentDb.RetrievedDocument {
  readonly test: string;
  readonly kind: "IRetrievedMyDocument";
}

class MyModel extends DocumentDbModel<
  IMyDocument,
  INewMyDocument,
  IRetrievedMyDocument
> {
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super();
    this.toBaseType = o => {
      return {
        test: o.test
      };
    };
    this.toRetrieved = result => {
      return {
        ...result,
        kind: "IRetrievedMyDocument",
        test: result.test
      };
    };
    this.dbClient = dbClient;
    this.collectionUri = collectionUrl;
  }
}

jest.mock("../documentdb");
import * as DocumentDbUtils from "../documentdb";

const aDbClient: DocumentDb.DocumentClient = {} as any;
const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "mydocuments"
);
const aDocumentUri = DocumentDbUtils.getDocumentUri(
  aCollectionUri,
  "mydocument"
);

describe("create", () => {
  it("should create a document", async () => {
    jest.resetAllMocks();
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(right({}))
    );
    const model = new MyModel(aDbClient, aCollectionUri);
    await model.create(
      {
        id: "test-id-1",
        kind: "INewMyDocument",
        test: "test"
      },
      "test-partition"
    );
    expect(DocumentDbUtils.createDocument).toHaveBeenCalledWith(
      aDbClient,
      aCollectionUri,
      {
        id: "test-id-1",
        test: "test"
      },
      "test-partition"
    );
  });

  it("should return the query error", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(left("error"))
    );
    const result = await model.create(
      {
        id: "test-id-1",
        kind: "INewMyDocument",
        test: "test"
      },
      "test-partition"
    );
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toBe("error");
    }
  });

  it("should return the created document as retrieved type", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          id: "test-id-1",
          test: "test"
        })
      )
    );
    const result = await model.create(
      {
        id: "test-id-1",
        kind: "INewMyDocument",
        test: "test"
      },
      "test-partition"
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        id: "test-id-1",
        kind: "IRetrievedMyDocument",
        test: "test"
      });
    }
  });
});

describe("find", () => {
  it("should retrieve an existing document", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          id: "test-id-1",
          test: "test"
        })
      )
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.find("test-id-1", "test-partition");
    expect(DocumentDbUtils.readDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      "test-partition"
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value.isSome());
      expect(result.value.toUndefined()).toEqual({
        id: "test-id-1",
        kind: "IRetrievedMyDocument",
        test: "test"
      });
    }
  });

  it("should return an empty option if the document does not exist", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 404, body: "Not found" }))
    );
    const result = await model.find("test-id-1", "test-partition");
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value.isNone());
    }
  });

  it("should return the query error", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 500, body: "Error" }))
    );
    const result = await model.find("test-id-1", "test-partition");
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ code: 500, body: "Error" });
    }
  });
});

describe("update", () => {
  it("should update an existing document", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          id: "test-id-1",
          test: "test"
        })
      )
    );
    (DocumentDbUtils.replaceDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          id: "test-id-1",
          test: "test",
          test2: "test"
        })
      )
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.update("test-id-1", "test-partition", d => {
      return {
        ...d,
        test2: "test"
      };
    });
    expect(DocumentDbUtils.replaceDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      {
        id: "test-id-1",
        test: "test",
        test2: "test"
      },
      "test-partition"
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value.isSome());
      expect(result.value.toUndefined()).toEqual({
        id: "test-id-1",
        kind: "IRetrievedMyDocument",
        test: "test",
        test2: "test"
      });
    }
  });

  it("should return an empty option if the document does not exist", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 404, body: "Not found" }))
    );
    const result = await model.update("test-id-1", "test-partition", d => d);
    expect(DocumentDbUtils.replaceDocument).not.toHaveBeenCalled();
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value.isNone());
    }
  });

  it("should return the query error of readDocument", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 500, body: "Error" }))
    );
    const result = await model.update("test-id-1", "test-partition", d => d);
    expect(DocumentDbUtils.replaceDocument).not.toHaveBeenCalled();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ code: 500, body: "Error" });
    }
  });

  it("should return the query error of replaceDocument", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          id: "test-id-1",
          test: "test"
        })
      )
    );
    (DocumentDbUtils.replaceDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 500, body: "Error" }))
    );
    const result = await model.update("test-id-1", "test-partition", d => d);
    expect(DocumentDbUtils.replaceDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ code: 500, body: "Error" });
    }
  });
});

describe("attach", () => {
  it("should return an attached media to an existing document", async () => {
    jest.resetAllMocks();
    const aDocumentId = "mydocument";
    const aPartitionKey = "partitionKey";
    const anAttachment = {
      contentType: "application/json",
      media: "https://example.com/media"
    };
    const getDocumentUriSpy = jest
      .spyOn(DocumentDbUtils, "getDocumentUri")
      .mockReturnValueOnce(aDocumentUri);
    const upsertAttachmentSpy = jest
      .spyOn(DocumentDbUtils, "upsertAttachment")
      .mockReturnValueOnce(Promise.resolve(right(anAttachment)));
    const model = new MyModel(aDbClient, aCollectionUri);
    const result = await model.attach(aDocumentId, aPartitionKey, anAttachment);
    expect(getDocumentUriSpy).toBeCalledWith(aCollectionUri, aDocumentId);
    expect(
      upsertAttachmentSpy
    ).toBeCalledWith(aDbClient, undefined, anAttachment, {
      partitionKey: aPartitionKey
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeFalsy();
      result.value.map(r => expect(r).toEqual(anAttachment));
    }
    upsertAttachmentSpy.mockReset();
    getDocumentUriSpy.mockReset();
  });
});

describe("getAttachments", () => {
  it("should return attachments iterator for an existing document", async () => {
    const aDocumentId = "mydocument";
    const queryAttachmentsSpy = jest.spyOn(DocumentDbUtils, "queryAttachments");
    const model = new MyModel(aDbClient, aCollectionUri);
    const feedOptions = {};
    await model.getAttachments(aDocumentId, feedOptions);
    expect(queryAttachmentsSpy).toHaveBeenCalledWith(
      aDbClient,
      aCollectionUri,
      feedOptions
    );
  });
});
