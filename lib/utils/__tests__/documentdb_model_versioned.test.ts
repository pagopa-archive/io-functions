/* tslint:disable:no-any */

import { NonEmptyString } from "italia-ts-commons/dist/lib/strings";

jest.mock("../documentdb");
import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../documentdb";

import { isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { NonNegativeNumber } from "italia-ts-commons/dist/lib/numbers";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../documentdb_model_versioned";

afterEach(() => {
  jest.resetAllMocks();
});

const aModelIdField = "aModelIdField";
const aModelIdValue = "aModelIdValue";
const aPartitionKeyField = "aPartitionKeyField";
const aPartitionKeyValue = "aPartitionKeyValue";

interface IMyDocument {
  readonly [aModelIdField]: string;
  readonly test: string;
}

interface INewMyDocument
  extends IMyDocument,
    DocumentDb.NewDocument,
    VersionedModel {
  readonly kind: "INewMyDocument";
}

interface IRetrievedMyDocument
  extends IMyDocument,
    DocumentDb.RetrievedDocument,
    VersionedModel {
  readonly test: string;
  readonly kind: "IRetrievedMyDocument";
}

function getModelId(_: IMyDocument): ModelId {
  return (aModelIdValue as any) as ModelId;
}

function updateModelId(
  o: IMyDocument,
  id: NonEmptyString,
  version: NonNegativeNumber
): INewMyDocument {
  return {
    ...o,
    id,
    kind: "INewMyDocument",
    version
  };
}

class MyModel extends DocumentDbModelVersioned<
  IMyDocument,
  INewMyDocument,
  IRetrievedMyDocument
> {
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(
      dbClient,
      collectionUrl,
      // toBaseType
      o => {
        return {
          aModelIdField: o.aModelIdField,
          test: o.test
        };
      },
      // toRetrieved
      result => {
        return {
          ...result,
          aModelIdField: aModelIdValue,
          kind: "IRetrievedMyDocument",
          test: result.test,
          version: result.version
        };
      },
      getModelId,
      updateModelId
    );
  }
}
const aDbClient: DocumentDb.DocumentClient = {} as any;
const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mydb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "mydocuments"
);

const aMyDocumentId = aModelIdValue + "-000000000000000";

const aNewMyDocument: IMyDocument = {
  [aModelIdField]: aModelIdValue,
  test: "aNewMyDocument"
};

const aCreatedMyDocument = {
  id: aMyDocumentId + "1",
  [aModelIdField]: aModelIdValue,
  test: "aNewMyDocument",
  version: 1
};

const anExistingDocument = {
  id: aMyDocumentId + "1",
  [aModelIdField]: aModelIdValue,
  test: "anExistingDocument",
  version: 1
};

describe("upsert", () => {
  it("should create a new document", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(none))
    );
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(right(aCreatedMyDocument))
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.upsert(
      aNewMyDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      {
        ...aNewMyDocument,
        id: aMyDocumentId + "0",
        kind: undefined,
        version: 0
      },
      aPartitionKeyValue
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        id: aMyDocumentId + "1",
        kind: "IRetrievedMyDocument",
        version: 1
      });
    }
  });

  it("should update an existing document", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(some(anExistingDocument)))
    );
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          ...anExistingDocument,
          id: aMyDocumentId + "2",
          version: 2
        })
      )
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.upsert(
      anExistingDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      {
        ...anExistingDocument,
        id: aMyDocumentId + "2",
        kind: undefined,
        version: 2
      },
      aPartitionKeyValue
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...anExistingDocument,
        id: aMyDocumentId + "2",
        kind: "IRetrievedMyDocument",
        version: 2
      });
    }
  });

  it("should return on error", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(left(new Error()))
    );
    await model.upsert(
      aNewMyDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
});

describe("update", () => {
  it("should return on error", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left(new Error()))
    );
    await model.update(aModelIdValue, aPartitionKeyValue, curr => curr);
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(none))
    );
    // @ts-ignore (ignore "protected" modifier)
    await model.findLastVersionByModelId(aModelIdField, aModelIdValue);
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
});
