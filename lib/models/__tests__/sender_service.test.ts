// tslint:disable:no-any no-inferred-empty-object-type

import { isLeft, isRight } from "fp-ts/lib/Either";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "io-documentdb-utils";

import { FiscalCode } from "../../api/definitions/FiscalCode";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { NonNegativeNumber } from "../../../node_modules/italia-ts-commons/lib/numbers";
import { ServiceId } from "../../api/definitions/ServiceId";
import {
  NewSenderService,
  RetrievedSenderService,
  SenderServiceModel
} from "../sender_service";

const aDatabaseUri = DocumentDbUtils.DocumentDb.getDatabaseUri(
  "mockdb" as NonEmptyString
);
const aSenderServicesCollectionUri = DocumentDbUtils.DocumentDb.getCollectionUri(
  aDatabaseUri,
  "SenderServices"
);

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aServiceId = "s123" as ServiceId;

const aNewSenderService: NewSenderService = {
  id: "A_SenderService_ID" as NonEmptyString,
  kind: "INewSenderService",
  lastNotificationAt: new Date(),
  recipientFiscalCode: aFiscalCode,
  serviceId: aServiceId,
  version: 1 as NonNegativeNumber
};

const aRetrievedSenderService: RetrievedSenderService = {
  ...aNewSenderService,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedSenderService"
};

describe("createSenderService", () => {
  it("should createOrUpdate a new SenderService", async () => {
    const clientMock = {
      upsertDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedSenderService)
      )
    };

    const model = new SenderServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aSenderServicesCollectionUri
    );

    const result = await model.createOrUpdate(
      aNewSenderService,
      aNewSenderService.recipientFiscalCode
    );

    expect(clientMock.upsertDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedSenderService);
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new SenderServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aSenderServicesCollectionUri
    );

    const result = await model.create(
      aNewSenderService,
      aNewSenderService.recipientFiscalCode
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/SenderServices"
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewSenderService,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewSenderService.recipientFiscalCode
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
        cb(undefined, aRetrievedSenderService)
      )
    };

    const model = new SenderServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aSenderServicesCollectionUri
    );

    const result = await model.find(
      aRetrievedSenderService.id,
      aRetrievedSenderService.serviceId
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/SenderServices/docs/A_SenderService_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedSenderService.serviceId
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedSenderService);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new SenderServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aSenderServicesCollectionUri
    );

    const result = await model.find(
      aRetrievedSenderService.id,
      aRetrievedSenderService.recipientFiscalCode
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
