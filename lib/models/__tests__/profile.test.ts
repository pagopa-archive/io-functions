// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

import { IProfile, IRetrievedProfile, ProfileModel } from "../profile";

const profilesCollectionUrl = {} as DocumentDbUtils.DocumentDbCollectionUrl;
const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

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

    const result = await model.create(newProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
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

    const result = await model.create(newProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});

describe("updateProfile", () => {

  it("should update an existing profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
        });
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const pendingProfile: IRetrievedProfile = {
      _self: "xyz",
      _ts: "xyz",
      fiscalCode: aFiscalCode,
      id: "xyz",
      kind: "IRetrievedProfile",
      version: toNonNegativeNumber(0).get,
    };

    const result = await model.updateProfile(pendingProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty("partitionKey", aFiscalCode);
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.fiscalCode).toEqual(pendingProfile.fiscalCode);
      expect(result.right.id).toEqual(`${aFiscalCode}-${"0".repeat(15)}1`);
      expect(result.right.version).toEqual(1);
    }
  });

  it("should reject the promise in case of error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const pendingProfile: IRetrievedProfile = {
      _self: "xyz",
      _ts: "xyz",
      fiscalCode: aFiscalCode,
      id: "xyz",
      kind: "IRetrievedProfile",
      version: toNonNegativeNumber(0).get,
    };

    const result = await model.updateProfile(pendingProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });

});
