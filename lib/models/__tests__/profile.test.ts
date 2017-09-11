// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

import { IProfile, IRetrievedProfile, ProfileModel } from "../profile";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const profilesCollectionUrl = DocumentDbUtils.getCollectionUri(aDatabaseUri, "profiles");

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aRetrievedProfile: IRetrievedProfile = {
  _self: "xyz",
  _ts: "xyz",
  fiscalCode: aFiscalCode,
  id: "xyz",
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(0).get,
};

describe("findOneProfileByFiscalCode", () => {

  it("should resolve a promise to an existing profile", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ "result" ], undefined)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, profilesCollectionUrl);

    const result = await model.findOneProfileByFiscalCode(aFiscalCode);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual("result");
    }
  });

  it("should resolve a promise to undefined if no profile is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [ ], undefined)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, profilesCollectionUrl);

    const result = await model.findOneProfileByFiscalCode(aFiscalCode);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });

});

describe("createProfile", () => {

  it("should create a new profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
        });
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: IProfile = {
      fiscalCode: aFiscalCode,
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty("partitionKey", aFiscalCode);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.fiscalCode).toEqual(newProfile.fiscalCode);
      expect(result.right.id).toEqual(`${aFiscalCode}-${"0".repeat(16)}`);
      expect(result.right.version).toEqual(0);
    }
  });

  it("should reject the promise in case of error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: IProfile = {
      fiscalCode: aFiscalCode,
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("update", () => {

  it("should update an existing profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
        });
      }),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile)),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(
      aRetrievedProfile.fiscalCode,
      aRetrievedProfile.fiscalCode,
      (p) => {
        return {
          ...p,
          email: "new@example.com",
        };
      },
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty("partitionKey", aFiscalCode);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      const updatedProfile = result.right.get;
      expect(updatedProfile.fiscalCode).toEqual(aRetrievedProfile.fiscalCode);
      expect(updatedProfile.id).toEqual(`${aFiscalCode}-${"0".repeat(15)}1`);
      expect(updatedProfile.version).toEqual(1);
      expect(updatedProfile.email).toEqual("new@example.com");
    }
  });

  it("should reject the promise in case of error (read)", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error")),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, (o) => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

  it("should reject the promise in case of error (create)", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile)),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, (o) => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});
