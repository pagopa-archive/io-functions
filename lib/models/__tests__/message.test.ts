// tslint:disable:no-object-mutation
// tslint:disable:no-any

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../api/definitions/MessageContent";

import { NonEmptyString } from "../../utils/strings";

import { fromNullable, none, some } from "fp-ts/lib/Option";

import {
  MessageModel,
  NewMessageWithContent,
  RetrievedMessageWithContent
} from "../message";

import { ModelId } from "../../utils/documentdb_model_versioned";

jest.mock("../../utils/azure_storage");
import { TimeToLive } from "../../api/definitions/TimeToLive";
import * as azureStorageUtils from "../../utils/azure_storage";

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aMessagesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "messages"
);

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aSerializedNewMessageWithContent = {
  content: aMessageContent,
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ModelId,
  senderUserId: "u123" as NonEmptyString,
  timeToLive: 3600 as TimeToLive
};

const aNewMessageWithContent: NewMessageWithContent = {
  ...aSerializedNewMessageWithContent,
  createdAt: new Date(),
  kind: "INewMessageWithContent"
};

const aSerializedRetrievedMessageWithContent = {
  ...aSerializedNewMessageWithContent,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessageWithContent"
};

const aRetrievedMessageWithContent: RetrievedMessageWithContent = {
  ...aNewMessageWithContent,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessageWithContent"
};

describe("createMessage", () => {
  it("should create a new Message", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
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
        cb(undefined, aSerializedRetrievedMessageWithContent)
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

    const resultIterator = model.findMessages(
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
        cb(undefined, aSerializedRetrievedMessageWithContent)
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
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedMessageWithContent,
        createdAt: expect.any(Date)
      });
    }
  });

  it("should return an empty value if the recipient doesn't match", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      "FRLFRC73E04B157I" as FiscalCode,
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
      "FRLFRC73E04B157I" as FiscalCode,
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

describe("getStoredContent", () => {
  const aMessageId = "MESSAGE_ID";
  const aPartitionKey = "SPNDNL80R13Y555Z" as FiscalCode;
  const anAttachmentMeta = { name: "attachmentMeta" };
  it("should get message content from blob text", async () => {
    const aBlobService = {
      getUrl: jest.fn().mockReturnValue("anUrl")
    };
    const model = new MessageModel(
      {} as any,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(
        Promise.resolve(right(fromNullable(JSON.stringify(aMessageContent))))
      );
    const getAttachmentsSpy = jest
      .spyOn(model, "getAttachments")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(
              Promise.resolve(right(some([anAttachmentMeta])))
            )
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const content = await model.getStoredContent(
      aBlobService as any,
      aMessageId,
      aPartitionKey
    );
    expect(getBlobAsTextSpy).toBeCalledWith(
      aBlobService as any,
      expect.any(String),
      expect.any(String)
    );
    expect(getAttachmentsSpy).toBeCalledWith(aMessageId, {
      partitionKey: aPartitionKey
    });
    expect(isRight(content)).toBeTruthy();
    if (isRight(content)) {
      expect(content.value.map(a => expect(a).toEqual(aMessageContent)));
    }

    getBlobAsTextSpy.mockReset();
    getAttachmentsSpy.mockReset();
  });
  it("should fail with an error when the blob cannot be retrieved", async () => {
    const aBlobService = {
      getUrl: jest.fn().mockReturnValue("anUrl")
    };
    const model = new MessageModel(
      {} as any,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );
    const err = new Error();
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(Promise.resolve(left(err)));
    const getAttachmentsSpy = jest
      .spyOn(model, "getAttachments")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(
              Promise.resolve(right(some([anAttachmentMeta])))
            )
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const content = await model.getStoredContent(
      aBlobService as any,
      aMessageId,
      aPartitionKey
    );
    expect(isLeft(content)).toBeTruthy();
    if (isLeft(content)) {
      expect(content.value).toBe(err);
    }
    getBlobAsTextSpy.mockReset();
    getAttachmentsSpy.mockReset();
  });
  it("should fail with an error when the retrieved blob is empty", async () => {
    const aBlobService = {
      getUrl: jest.fn().mockReturnValue("anUrl")
    };
    const model = new MessageModel(
      {} as any,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(Promise.resolve(right(none)));
    const getAttachmentsSpy = jest
      .spyOn(model, "getAttachments")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(
              Promise.resolve(right(some([anAttachmentMeta])))
            )
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const content = await model.getStoredContent(
      aBlobService as any,
      aMessageId,
      aPartitionKey
    );
    expect(isLeft(content)).toBeTruthy();
    if (isLeft(content)) {
      expect(content.value).toBeInstanceOf(Error);
    }
    getBlobAsTextSpy.mockReset();
    getAttachmentsSpy.mockReset();
  });
  it("should succeed when message has no attachments", async () => {
    const aBlobService = {
      getUrl: jest.fn().mockReturnValue("anUrl")
    };
    const model = new MessageModel(
      {} as any,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );
    const getAttachmentsSpy = jest
      .spyOn(model, "getAttachments")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const content = await model.getStoredContent(
      aBlobService as any,
      aMessageId,
      aPartitionKey
    );
    expect(isRight(content)).toBeTruthy();
    if (isRight(content)) {
      expect(content.value).toBe(none);
    }
    getAttachmentsSpy.mockReset();
  });
});
