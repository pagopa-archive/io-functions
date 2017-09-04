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

import { ModelId } from "../../utils/versioned_model";

const aNotificationsCollectionUrl = "mocknotifications" as DocumentDbUtils.DocumentDbCollectionUrl;

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

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.create(aNewNotification, aNewNotification.messageId);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.create(aNewNotification, aNewNotification.messageId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(aNotificationsCollectionUrl);
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual(aNewNotification);
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewNotification.messageId,
    });
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("findNotification", () => {

  it("should return an existing message", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedNotification)),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.find(aRetrievedNotification.id, aRetrievedNotification.messageId);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual("mocknotifications/docs/A_NOTIFICATION_ID");
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedNotification.messageId,
    });
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual(aRetrievedNotification);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error")),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.find(aRetrievedNotification.id, aRetrievedNotification.fiscalCode);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("updateNotification", () => {

  const anEmailNotification: INotificationChannelEmail = {
    kind: "INotificationChannelEmail",
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

    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedNotification)),
      replaceDocument: jest.fn((_, __, ___, cb) => cb(undefined, {
        ...aRetrievedNotification,
        emailNotification: anEmailNotification,
      })),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual("mocknotifications/docs/A_NOTIFICATION_ID");

    expect(updateFunction).toHaveBeenCalledTimes(1);
    expect(updateFunction).toHaveBeenCalledWith({
      fiscalCode: aRetrievedNotification.fiscalCode,
      messageId: aRetrievedNotification.messageId,
    });

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right).toEqual({
        ...aRetrievedNotification,
        emailNotification: anEmailNotification,
      });
    }
  });

  it("should return error if Notification does not exist", async () => {
    updateFunction.mockReset();

    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error")),
      replaceDocument: jest.fn(),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);

    expect(updateFunction).not.toHaveBeenCalled();

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

  it("should return error if update fails", async () => {
    updateFunction.mockReset();

    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedNotification)),
      replaceDocument: jest.fn((_, __, ___, cb) => cb("error")),
    };

    const model = new NotificationModel((clientMock as any) as DocumentDb.DocumentClient, aNotificationsCollectionUrl);

    const result = await model.update(
      aRetrievedNotification.messageId,
      aRetrievedNotification.id,
      updateFunction,
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);

    expect(updateFunction).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});
