// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

import { INewMessage, IRetrievedMessage, MessageModel } from "../message";

import { ModelId } from "../../utils/documentdb_model_versioned";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const aMessagesCollectionUrl = DocumentDbUtils.getCollectionUri(aDatabaseUri, "messages");

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aNewMessage: INewMessage = {
  bodyShort: "some text",
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID",
  kind: "INewMessage",
  senderOrganizationId: "agid" as ModelId,
};

const aRetrievedMessage: IRetrievedMessage = {
  ...aNewMessage,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessage",
};

describe("createMessage", () => {

  it("should create a new Message", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(undefined, aRetrievedMessage)),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.create(aNewMessage, aNewMessage.fiscalCode);

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(aRetrievedMessage);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.create(aNewMessage, aNewMessage.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual("dbs/mockdb/colls/messages");
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewMessage,
      kind: undefined,
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewMessage.fiscalCode,
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
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedMessage)),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.find(aRetrievedMessage.id, aRetrievedMessage.fiscalCode);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual("dbs/mockdb/colls/messages/docs/A_MESSAGE_ID");
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessage.fiscalCode,
    });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedMessage);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({code: 500})),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.find(aRetrievedMessage.id, aRetrievedMessage.fiscalCode);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual({code: 500});
    }
  });

  it("should return an empty value on 404 error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({code: 404})),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.find(aRetrievedMessage.id, aRetrievedMessage.fiscalCode);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

});

describe("findMessages", () => {

  it("should return the messages for a fiscal code", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result" ], undefined)),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const resultIterator = await model.findMessages(aRetrievedMessage.fiscalCode);

    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);

    const result = await resultIterator.executeNext();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual([ "result" ]);
    }
  });

});

describe("findMessageForRecipient", () => {

  it("should return the messages if the recipient matches", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedMessage)),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.findMessageForRecipient(aRetrievedMessage.fiscalCode, aRetrievedMessage.id);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual("dbs/mockdb/colls/messages/docs/A_MESSAGE_ID");
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessage.fiscalCode,
    });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedMessage);
    }
  });

  it("should return an empty value if the recipient doesn't match", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedMessage)),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.findMessageForRecipient(toFiscalCode("FRLFRC73E04B157I").get, aRetrievedMessage.id);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error")),
    };

    const model = new MessageModel((clientMock as any) as DocumentDb.DocumentClient, aMessagesCollectionUrl);

    const result = await model.findMessageForRecipient(toFiscalCode("FRLFRC73E04B157I").get, aRetrievedMessage.id);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toBe("error");
    }
  });

});
