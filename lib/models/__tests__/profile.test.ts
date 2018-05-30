/* tslint:disable:no-any */
/* tslint:disable:no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";
import { TaxCode } from "../../api/definitions/TaxCode";

import { Profile, ProfileModel, RetrievedProfile } from "../profile";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const profilesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "profiles"
);

const aTaxCode = "FRLFRC74E04B157I" as TaxCode;

const aRetrievedProfile: RetrievedProfile = {
  _self: "xyz",
  _ts: 123,
  id: "xyz" as NonEmptyString,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  taxCode: aTaxCode,
  version: 0 as NonNegativeNumber
};

describe("findOneProfileByTaxCode", () => {
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

    const result = await model.findOneProfileByTaxCode(aTaxCode);

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

    const result = await model.findOneProfileByTaxCode(aTaxCode);

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
      taxCode: aTaxCode
    };

    const result = await model.create(newProfile, newProfile.taxCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aTaxCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.taxCode).toEqual(newProfile.taxCode);
      expect(result.value.id).toEqual(`${aTaxCode}-${"0".repeat(16)}`);
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
      taxCode: aTaxCode
    };

    const result = await model.create(newProfile, newProfile.taxCode);

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
      aRetrievedProfile.taxCode,
      aRetrievedProfile.taxCode,
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
      aTaxCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedProfile = result.value.value;
        expect(updatedProfile.taxCode).toEqual(aRetrievedProfile.taxCode);
        expect(updatedProfile.id).toEqual(`${aTaxCode}-${"0".repeat(15)}1`);
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

    const result = await model.update(aTaxCode, aTaxCode, o => o);

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

    const result = await model.update(aTaxCode, aTaxCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
