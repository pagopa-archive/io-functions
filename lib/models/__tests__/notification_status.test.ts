// tslint:disable:no-any

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import * as DocumentDbUtils from "../../utils/documentdb";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { NotificationChannelEnum } from "../../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../../api/definitions/NotificationChannelStatusValue";
import {
  NotificationStatus,
  NotificationStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "../notification_status";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const collectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "notification-status"
);

const aNotificationStatusId = "A_NOTIFICATION_ID:EMAIL" as NotificationStatusId;

const aSerializedNotificationStatus = {
  channel: NotificationChannelEnum.EMAIL,
  messageId: "A_MESSAGE_ID" as NonEmptyString,
  notificationId: "A_NOTIFICATION_ID" as NonEmptyString,
  status: NotificationChannelStatusValueEnum.SENT,
  statusId: aNotificationStatusId,
  updatedAt: new Date().toISOString()
};

const aNotificationStatus = NotificationStatus.decode(
  aSerializedNotificationStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix NotificationStatus mock: " + error);
});

const aSerializedRetrievedNotificationStatus = {
  _self: "_self",
  _ts: 1,
  ...aSerializedNotificationStatus,
  id: `${aNotificationStatusId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedNotificationStatus = RetrievedNotificationStatus.decode(
  aSerializedRetrievedNotificationStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix NotificationStatus mock: " + error);
});

describe("findOneNotificationStatusById", () => {
  it("should resolve a promise to an existing notification status", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb =>
        cb(undefined, [aSerializedRetrievedNotificationStatus], undefined)
      )
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new NotificationStatusModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrl
    );

    const result = await model.findOneNotificationStatusByNotificationChannel(
      "A_NOTIFICATION_ID" as NonEmptyString,
      NotificationChannelEnum.EMAIL
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedNotificationStatus);
    }
  });

  it("should resolve a promise to an empty value if no NotificationStatus is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new NotificationStatusModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      collectionUrl
    );

    const result = await model.findOneNotificationStatusByNotificationChannel(
      "A_NOTIFICATION_ID" as NonEmptyString,
      NotificationChannelEnum.EMAIL
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("createNotificationStatus", () => {
  it("should create a new NotificationStatus", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb(undefined, aSerializedRetrievedNotificationStatus);
      })
    };

    const model = new NotificationStatusModel(clientMock, collectionUrl);

    const result = await model.create(
      aNotificationStatus,
      aNotificationStatus.notificationId
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aNotificationStatus.notificationId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.statusId).toEqual(aNotificationStatus.statusId);
      expect(result.value.id).toEqual(
        `${aNotificationStatusId}-${"0".repeat(16)}`
      );
      expect(result.value.version).toEqual(0);
    }
  });

  it("should resolve the promise to an error value in case of a query error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new NotificationStatusModel(clientMock, collectionUrl);

    const result = await model.create(
      aNotificationStatus,
      aSerializedNotificationStatus.notificationId
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("updateNotificationStatus", () => {
  it("should update an existing NotificationStatus", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, ___, cb) => {
        const retrievedDocument = RetrievedNotificationStatus.encode(
          newDocument
        );
        cb(undefined, { ...retrievedDocument, _self: "_self", _ts: 1 });
      }),
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedNotificationStatus)
      )
    };

    const model = new NotificationStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedNotificationStatus.id,
      aRetrievedNotificationStatus.notificationId,
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
      aRetrievedNotificationStatus.notificationId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedNotificationStatus = result.value.value;
        expect(updatedNotificationStatus.statusId).toEqual(
          aRetrievedNotificationStatus.statusId
        );
        expect(updatedNotificationStatus.id).toEqual(
          `${aNotificationStatusId}-${"0".repeat(15)}1`
        );
        expect(updatedNotificationStatus.version).toEqual(1);
        expect(updatedNotificationStatus.status).toEqual(
          aRetrievedNotificationStatus.status
        );
      }
    }
  });

  it("should resolve the promise to an error value in case of a readDocument error", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new NotificationStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedNotificationStatus.id,
      aRetrievedNotificationStatus.notificationId,
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
        cb(undefined, aSerializedRetrievedNotificationStatus)
      )
    };

    const model = new NotificationStatusModel(clientMock, collectionUrl);

    const result = await model.update(
      aRetrievedNotificationStatus.id,
      aRetrievedNotificationStatus.notificationId,
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
