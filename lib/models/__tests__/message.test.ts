// tslint:disable:no-object-mutation
// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toBodyShort } from "../../api/definitions/BodyShort";
import { toFiscalCode } from "../../api/definitions/FiscalCode";

import { toNonEmptyString } from "../../utils/strings";

import { option } from "ts-option";

import {
  INewMessageWithContent,
  IRetrievedMessageWithContent,
  MessageModel
} from "../message";

import { ModelId } from "../../utils/documentdb_model_versioned";

jest.mock("../../utils/azure_storage");
import * as azureStorage from "../../utils/azure_storage";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const aMessagesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "messages"
);

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aNewMessageWithContent: INewMessageWithContent = {
  content: {
    bodyShort: toBodyShort("some text").get
  },
  fiscalCode: aFiscalCode,
  id: toNonEmptyString("A_MESSAGE_ID").get,
  kind: "INewMessageWithContent",
  senderOrganizationId: "agid" as ModelId,
  senderUserId: toNonEmptyString("u123").get
};

const aRetrievedMessageWithContent: IRetrievedMessageWithContent = {
  ...aNewMessageWithContent,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessageWithContent"
};

describe("createMessage", () => {
  it("should create a new Message", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.create(
      aNewMessageWithContent,
      aNewMessageWithContent.fiscalCode
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(aRetrievedMessageWithContent);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.create(
      aNewMessageWithContent,
      aNewMessageWithContent.fiscalCode
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages"
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewMessageWithContent,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewMessageWithContent.fiscalCode
    });
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });
});

describe("find", () => {
  it("should return an existing message", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages/docs/A_MESSAGE_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessageWithContent.fiscalCode
    });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedMessageWithContent);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 500 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual({ code: 500 });
    }
  });

  it("should return an empty value on 404 error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 404 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });
});

describe("findMessages", () => {
  it("should return the messages for a fiscal code", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, ["result"], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock)
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const resultIterator = await model.findMessages(
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);

    const result = await resultIterator.executeNext();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(["result"]);
    }
  });
});

describe("findMessageForRecipient", () => {
  it("should return the messages if the recipient matches", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.findMessageForRecipient(
      aRetrievedMessageWithContent.fiscalCode,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages/docs/A_MESSAGE_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessageWithContent.fiscalCode
    });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedMessageWithContent);
    }
  });

  it("should return an empty value if the recipient doesn't match", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.findMessageForRecipient(
      toFiscalCode("FRLFRC73E04B157I").get,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );

    const result = await model.findMessageForRecipient(
      toFiscalCode("FRLFRC73E04B157I").get,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe("error");
    }
  });
});

describe("attachStoredContent", () => {
  const aMessageId = "MESSAGE_ID";
  const aPartitionKey = "PARTITION_KEY";
  const anAttachmentMeta = { name: "attachmentMeta" };
  const clientMock = {
    upsertAttachment: jest.fn((_, __, ___, cb) =>
      cb(undefined, anAttachmentMeta)
    )
  };
  const aBlobResult = { name: "blobName" };
  const blobService = azureStorage.getBlobService("aConnectionString");

  it("should upsert a blob from text and attach it to an existing document", async () => {
    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl
    );
    const upsertBlobFromTextSpy = jest
      .spyOn(azureStorage, "upsertBlobFromText")
      .mockReturnValueOnce(option(aBlobResult));
    const attachSpy = jest.spyOn(model, "attach");
    const attachment = await model.attachStoredContent(
      blobService,
      aMessageId,
      aPartitionKey,
      aRetrievedMessageWithContent
    );
    expect(upsertBlobFromTextSpy).toBeCalledWith(
      blobService,
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
    expect(attachSpy).toBeCalledWith(
      aMessageId,
      aPartitionKey,
      expect.any(Object)
    );
    expect(attachment.isRight).toBeTruthy();
    if (attachment.isRight) {
      expect(attachment.right.map(a => expect(a).toEqual(anAttachmentMeta)));
    }
    upsertBlobFromTextSpy.mockReset();
    attachSpy.mockReset();
    attachSpy.mockRestore();
  });
});
