// tslint:disable:no-any

import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { Option, Some } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../api/definitions/FiscalCode";
import { NotificationChannelStatusEnum } from "../../api/definitions/NotificationChannelStatus";

import { EmailString, NonEmptyString } from "../../utils/strings";

import {
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail,
  NotificationModel,
  RetrievedNotification
} from "../notification";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aNotificationsCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "notifications"
);

const aFiscalCode = _getO(
  t.validate("FRLFRC74E04B157I", FiscalCode).toOption()
);

const aNewNotification: NewNotification = {
  fiscalCode: aFiscalCode,
  id: _getO(t.validate("A_NOTIFICATION_ID", NonEmptyString).toOption()),
  kind: "INewNotification",
  messageId: _getO(t.validate("A_MESSAGE_ID", NonEmptyString).toOption())
};

const aRetrievedNotification: RetrievedNotification = {
  ...aNewNotification,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedNotification"
};

describe("createNotification", () => {
  it("should create a new Notification", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedNotification)
      )
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.create(
      aNewNotification,
      aNewNotification.messageId
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.create(
      aNewNotification,
      aNewNotification.messageId
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/notifications"
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewNotification,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewNotification.messageId
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
        cb(undefined, aRetrievedNotification)
      )
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.find(
      aRetrievedNotification.id,
      aRetrievedNotification.messageId
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/notifications/docs/A_NOTIFICATION_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedNotification.messageId
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.find(
      aRetrievedNotification.id,
      aRetrievedNotification.fiscalCode
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("update", () => {
  const anEmailNotification: NotificationChannelEmail = {
    addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
    status: NotificationChannelStatusEnum.SENT_TO_CHANNEL,
    toAddress: _getO(t.validate("to@example.com", EmailString).toOption())
  };

  const updateFunction = jest.fn(n => {
    return {
      ...n,
      emailNotification: anEmailNotification
    };
  });

  it("should update an existing Notification", async () => {
    updateFunction.mockReset();

    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedNotification)
      ),
      replaceDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, {
          ...aRetrievedNotification,
          emailNotification: anEmailNotification
        })
      )
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.update(
      aRetrievedNotification.id,
      aRetrievedNotification.messageId,
      updateFunction
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/notifications/docs/A_NOTIFICATION_ID"
    );

    expect(updateFunction).toHaveBeenCalledTimes(1);
    expect(updateFunction).toHaveBeenCalledWith({
      fiscalCode: aRetrievedNotification.fiscalCode,
      messageId: aRetrievedNotification.messageId
    });

    expect(clientMock.replaceDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedNotification,
        emailNotification: anEmailNotification
      });
    }
  });

  it("should return error if Notification does not exist", async () => {
    updateFunction.mockReset();

    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error")),
      replaceDocument: jest.fn()
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);

    expect(updateFunction).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should return error if update fails", async () => {
    updateFunction.mockReset();

    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedNotification)
      ),
      replaceDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new NotificationModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aNotificationsCollectionUri
    );

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);

    expect(updateFunction).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
