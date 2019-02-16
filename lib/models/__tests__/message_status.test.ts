// tslint:disable:no-any

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import { NonNegativeNumber } from "io-ts-commons/lib/numbers";
import { NonEmptyString } from "io-ts-commons/lib/strings";
import * as DocumentDbUtils from "../../utils/documentdb";

import { readableReport } from "io-ts-commons/lib/reporters";
import { MessageStatusValueEnum } from "../../api/definitions/MessageStatusValue";
import {
  MESSAGE_STATUS_COLLECTION_NAME,
  MessageStatus,
  MessageStatusModel,
  RetrievedMessageStatus
} from "../message_status";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const collectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  MESSAGE_STATUS_COLLECTION_NAME
);

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aSerializedMessageStatus = {
  messageId: aMessageId,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date().toISOString()
};

const aMessageStatus = MessageStatus.decode(
  aSerializedMessageStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix MessageStatus mock: " + error);
});

const aSerializedRetrievedMessageStatus = {
  _self: "_self",
  _ts: 1,
  ...aSerializedMessageStatus,
  id: `${aMessageId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedMessageStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedMessageStatus = RetrievedMessageStatus.decode(
  aSerializedRetrievedMessageStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix MessageStatus mock: " + error);
});

describe("findOneMessageStatusById", () => {
  it("should resolve a promise to an existing Message status", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb =>
        cb(undefined, [aSerializedRetrievedMessageStatus], undefined)
      ),
      hasMoreResults: jest.fn().mockReturnValue(false)
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new MessageStatusModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrl
    );

    const result = await model.findOneByMessageId(aMessageId);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedMessageStatus);
    }
  });

  it("should resolve a promise to an empty value if no MessageStatus is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined)),
      hasMoreResults: jest.fn().mockReturnValue(false)
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new MessageStatusModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrl
    );

    const result = await model.findOneByMessageId(aMessageId);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("createMessageStatus", () => {
  it("should create a new MessageStatus", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb(undefined, aSerializedRetrievedMessageStatus);
      })
    };

    const model = new MessageStatusModel(clientMock, collectionUrl);

    const result = await model.create(aMessageStatus, aMessageStatus.messageId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aMessageStatus.messageId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.messageId).toEqual(aMessageStatus.messageId);
      expect(result.value.id).toEqual(`${aMessageId}-${"0".repeat(16)}`);
      expect(result.value.version).toEqual(0);
    }
  });

  it("should resolve the promise to an error value in case of a query error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new MessageStatusModel(clientMock, collectionUrl);

    const result = await model.create(
      aMessageStatus,
      aSerializedMessageStatus.messageId
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("updateMessageStatus", () => {
  it("should update an existing MessageStatus", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, ___, cb) => {
        const retrievedDocument = RetrievedMessageStatus.encode(newDocument);
        cb(undefined, { ...retrievedDocument, _self: "_self", _ts: 1 });
      }),
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageStatus)
      )
    };

    const model = new MessageStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedMessageStatus.id,
      aRetrievedMessageStatus.messageId,
      p => {
        return {
          ...p
        };
      }
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aRetrievedMessageStatus.messageId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedMessageStatus = result.value.value;
        expect(updatedMessageStatus.messageId).toEqual(
          aRetrievedMessageStatus.messageId
        );
        expect(updatedMessageStatus.id).toEqual(
          `${aMessageId}-${"0".repeat(15)}1`
        );
        expect(updatedMessageStatus.version).toEqual(1);
        expect(updatedMessageStatus.status).toEqual(
          aRetrievedMessageStatus.status
        );
      }
    }
  });

  it("should resolve the promise to an error value in case of a readDocument error", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new MessageStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedMessageStatus.id,
      aRetrievedMessageStatus.messageId,
      o => o
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should resolve the promise to an error value in case of a createDocument error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageStatus)
      )
    };

    const model = new MessageStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedMessageStatus.id,
      aRetrievedMessageStatus.messageId,
      o => o
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
