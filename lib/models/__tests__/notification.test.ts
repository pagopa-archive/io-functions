// tslint:disable:no-any
import { isLeft, isRight } from "fp-ts/lib/Either";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { NotificationChannelStatus } from "../../api/definitions/NotificationChannelStatus";

import { toEmailString, toNonEmptyString } from "../../utils/strings";

import {
  INewNotification,
  INotificationChannelEmail,
  IRetrievedNotification,
  NotificationAddressSource,
  NotificationModel
} from "../notification";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const aNotificationsCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "notifications"
);

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aNewNotification: INewNotification = {
  fiscalCode: aFiscalCode,
  id: toNonEmptyString("A_NOTIFICATION_ID").get,
  kind: "INewNotification",
  messageId: toNonEmptyString("A_MESSAGE_ID").get
};

const aRetrievedNotification: IRetrievedNotification = {
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
      expect(result.value.isDefined).toBeTruthy();
      expect(result.value.get).toEqual(aRetrievedNotification);
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
  const anEmailNotification: INotificationChannelEmail = {
    addressSource: NotificationAddressSource.DEFAULT_ADDRESS,
    status: NotificationChannelStatus.SENT_TO_CHANNEL,
    toAddress: toEmailString("to@example.com").get
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
      expect(result.value.isDefined).toBeTruthy();
      expect(result.value.get).toEqual({
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
