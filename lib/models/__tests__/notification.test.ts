// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

import {
  INewNotification,
  INotificationChannelEmail,
  IRetrievedNotification,
  NotificationChannelStatus,
  NotificationModel,
} from "../notification";

import { ModelId } from "../../utils/documentdb_model_versioned";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const aNotificationsCollectionUri = DocumentDbUtils.getCollectionUri(aDatabaseUri, "notifications");

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aNewNotification: INewNotification = {
  fiscalCode: aFiscalCode,
  id: "A_NOTIFICATION_ID",
  kind: "INewNotification",
  messageId: "A_MESSAGE_ID",
};

const aRetrievedNotification: IRetrievedNotification = {
  ...aNewNotification,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedNotification",
};

describe("createNotification", () => {

  it("should create a new Notification", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(undefined, aRetrievedNotification)),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.create(aNewNotification, aNewNotification.messageId);

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.create(aNewNotification, aNewNotification.messageId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual("dbs/mockdb/colls/notifications");
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewNotification,
      kind: undefined,
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewNotification.messageId,
    });
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("find", () => {

  it("should return an existing message", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ aRetrievedNotification ], undefined)),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.find(aRetrievedNotification.id);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb("error")),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.find(aRetrievedNotification.id);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("update", () => {

  const anEmailNotification: INotificationChannelEmail = {
    status: NotificationChannelStatus.NOTIFICATION_SENT_TO_CHANNEL,
    toAddress: "to@example.com",
  };

  const updateFunction = jest.fn((n) => {
    return {
      ...n,
      emailNotification: anEmailNotification,
    };
  });

  it("should update an existing Notification", async () => {
    updateFunction.mockReset();

    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ aRetrievedNotification ], undefined)),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
      replaceDocument: jest.fn((_, __, ___, cb) => cb(undefined, {
        ...aRetrievedNotification,
        emailNotification: anEmailNotification,
      })),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(updateFunction).toHaveBeenCalledTimes(1);
    expect(updateFunction).toHaveBeenCalledWith({
      fiscalCode: aRetrievedNotification.fiscalCode,
      messageId: aRetrievedNotification.messageId,
    });

    expect(clientMock.replaceDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual({
        ...aRetrievedNotification,
        emailNotification: anEmailNotification,
      });
    }
  });

  it("should return an empty result if Notification does not exist", async () => {
    updateFunction.mockReset();

    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ ], undefined)),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
      replaceDocument: jest.fn((_, __, ___, cb) => cb(undefined, {
        ...aRetrievedNotification,
        emailNotification: anEmailNotification,
      })),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(updateFunction).not.toHaveBeenCalled();

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

  it("should return error if update fails", async () => {
    updateFunction.mockReset();

    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ aRetrievedNotification ], undefined)),
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock),
      replaceDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };
    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUri);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(updateFunction).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});
