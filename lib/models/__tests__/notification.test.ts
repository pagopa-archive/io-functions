// tslint:disable:no-any

import { isLeft, isRight } from "fp-ts/lib/Either";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../api/definitions/FiscalCode";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { EmailAddress } from "../../api/definitions/EmailAddress";
import { NotificationChannelEnum } from "../../api/definitions/NotificationChannel";
import {
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationModel,
  RetrievedNotification
} from "../notification";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aNotificationsCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "notifications"
);

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aNewEmailNotification: NewNotification = {
  channel: {
    [NotificationChannelEnum.EMAIL]: {
      addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
      toAddress: "to@example.com" as EmailAddress
    }
  },
  fiscalCode: aFiscalCode,
  id: "A_NOTIFICATION_ID" as NonEmptyString,
  kind: "INewNotification",
  messageId: "A_MESSAGE_ID" as NonEmptyString
};

const aRetrievedNotification: RetrievedNotification = {
  ...aNewEmailNotification,
  _self: "xyz",
  _ts: 123,
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
      aNewEmailNotification,
      aNewEmailNotification.messageId
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
      aNewEmailNotification,
      aNewEmailNotification.messageId
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/notifications"
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewEmailNotification,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewEmailNotification.messageId
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
