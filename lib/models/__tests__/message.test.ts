// tslint:disable:no-object-mutation
// tslint:disable:no-any

import * as t from "io-ts";

import { isLeft, isRight, right } from "fp-ts/lib/Either";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

import { NonEmptyString } from "../../utils/strings";

import { fromNullable, Option, Some } from "fp-ts/lib/Option";

import {
  IMessageContent,
  INewMessageWithContent,
  IRetrievedMessageWithContent,
  MessageModel
} from "../message";

import { ModelId } from "../../utils/documentdb_model_versioned";

jest.mock("../../utils/azure_storage");
import * as azureStorageUtils from "../../utils/azure_storage";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aMessagesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "messages"
);

const aMessageBodyMarkdown = _getO(
  t.validate("test".repeat(80), MessageBodyMarkdown).toOption()
);

const aMessageContent: IMessageContent = {
  bodyMarkdown: aMessageBodyMarkdown
};

const aFiscalCode = _getO(
  t.validate("FRLFRC74E04B157I", FiscalCode).toOption()
);

const aNewMessageWithContent: INewMessageWithContent = {
  content: aMessageContent,
  fiscalCode: aFiscalCode,
  id: _getO(t.validate("A_MESSAGE_ID", NonEmptyString).toOption()),
  kind: "INewMessageWithContent",
  senderServiceId: "agid" as ModelId,
  senderUserId: _getO(t.validate("u123", NonEmptyString).toOption())
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
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.create(
      aNewMessageWithContent,
      aNewMessageWithContent.fiscalCode
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedMessageWithContent);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
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
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
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
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
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
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedMessageWithContent);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 500 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual({ code: 500 });
    }
  });

  it("should return an empty value on 404 error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 404 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
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
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const resultIterator = await model.findMessages(
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);

    const result = await resultIterator.executeNext();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(["result"]);
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
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
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
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedMessageWithContent);
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
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      _getO(t.validate("FRLFRC73E04B157I", FiscalCode).toOption()),
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      _getO(t.validate("FRLFRC73E04B157I", FiscalCode).toOption()),
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toBe("error");
    }
  });
});

describe("attachStoredContent", () => {
  const aMessageId = "MESSAGE_ID";
  const aPartitionKey = "PARTITION_KEY";
  const anAttachmentMeta = { name: "attachmentMeta" };
  const aBlobResult = { name: "blobName" };
  it("should upsert a blob from text and attach it to an existing document", async () => {
    const aBlobService = {
      getUrl: jest.fn().mockReturnValue("anUrl")
    };
    const clientMock = {
      upsertAttachment: jest.fn((_, __, ___, cb) =>
        cb(undefined, anAttachmentMeta)
      )
    };
    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );
    const upsertBlobFromObjectSpy = jest
      .spyOn(azureStorageUtils, "upsertBlobFromObject")
      .mockReturnValueOnce(right(fromNullable(aBlobResult)));
    const attachSpy = jest.spyOn(model, "attach");
    const attachment = await model.attachStoredContent(
      aBlobService as any,
      aMessageId,
      aPartitionKey,
      aMessageContent
    );
    expect(upsertBlobFromObjectSpy).toBeCalledWith(
      aBlobService as any,
      expect.any(String),
      expect.any(String),
      aMessageContent
    );
    expect(attachSpy).toBeCalledWith(
      aMessageId,
      aPartitionKey,
      expect.any(Object)
    );
    expect(isRight(attachment)).toBeTruthy();
    if (isRight(attachment)) {
      expect(attachment.value.map(a => expect(a).toEqual(anAttachmentMeta)));
    }

    upsertBlobFromObjectSpy.mockReset();
    attachSpy.mockReset();
    attachSpy.mockRestore();
  });
});
