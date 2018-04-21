/* tslint:disable:no-any */
/* tslint:disable:no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { NonNegativeNumber } from "italia-ts-commons/dist/lib/numbers";
import {
  EmailString,
  NonEmptyString
} from "italia-ts-commons/dist/lib/strings";
import { FiscalCode } from "../../api/definitions/FiscalCode";

import { Profile, ProfileModel, RetrievedProfile } from "../profile";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const profilesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "profiles"
);

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aRetrievedProfile: RetrievedProfile = {
  _self: "xyz",
  _ts: 123,
  fiscalCode: aFiscalCode,
  id: "xyz" as NonEmptyString,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeNumber
};

describe("findOneProfileByFiscalCode", () => {
  it("should resolve a promise to an existing profile", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [aRetrievedProfile], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new ProfileModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      profilesCollectionUrl
    );

    const result = await model.findOneProfileByFiscalCode(aFiscalCode);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedProfile);
    }
  });

  it("should resolve a promise to undefined if no profile is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new ProfileModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      profilesCollectionUrl
    );

    const result = await model.findOneProfileByFiscalCode(aFiscalCode);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("createProfile", () => {
  it("should create a new profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      })
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: Profile = {
      fiscalCode: aFiscalCode
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.fiscalCode).toEqual(newProfile.fiscalCode);
      expect(result.value.id).toEqual(`${aFiscalCode}-${"0".repeat(16)}`);
      expect(result.value.version).toEqual(0);
    }
  });

  it("should reject the promise in case of error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: Profile = {
      fiscalCode: aFiscalCode
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("update", () => {
  it("should update an existing profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      }),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(
      aRetrievedProfile.fiscalCode,
      aRetrievedProfile.fiscalCode,
      p => {
        return {
          ...p,
          email: "new@example.com" as EmailString
        };
      }
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedProfile = result.value.value;
        expect(updatedProfile.fiscalCode).toEqual(aRetrievedProfile.fiscalCode);
        expect(updatedProfile.id).toEqual(`${aFiscalCode}-${"0".repeat(15)}1`);
        expect(updatedProfile.version).toEqual(1);
        expect(updatedProfile.email).toEqual("new@example.com");
      }
    }
  });

  it("should reject the promise in case of error (read)", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should reject the promise in case of error (create)", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
