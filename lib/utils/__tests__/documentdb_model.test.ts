// tslint:disable:no-object-mutation
// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import { left, right } from "../either";

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
const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mydb");
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "mydocuments"
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
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left).toBe("error");
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
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right).toEqual({
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
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right.isDefined);
      expect(result.right.get).toEqual({
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
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right.isEmpty);
    }
  });

  it("should return the query error", async () => {
    jest.resetAllMocks();
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left({ code: 500, body: "Error" }))
    );
    const result = await model.find("test-id-1", "test-partition");
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left).toEqual({ code: 500, body: "Error" });
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
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right.isDefined);
      expect(result.right.get).toEqual({
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
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right.isEmpty);
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
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left).toEqual({ code: 500, body: "Error" });
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
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left).toEqual({ code: 500, body: "Error" });
    }
  });
});
