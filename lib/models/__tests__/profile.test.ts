// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

import { IProfile, IRetrievedProfile, ProfileModel } from "../profile";

const profilesCollectionUrl = {} as DocumentDbUtils.DocumentDbCollectionUrl;
const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

describe("findOneProfileByFiscalCode", () => {

  it("should resolve a promise to an existing profile", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ "result" ], null)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, profilesCollectionUrl);

    const promise = model.findOneProfileByFiscalCode(aFiscalCode);

    return expect(promise).resolves.toEqual("result");
  });

  it("should resolve a promise to null if no profile is found", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ ], null)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, profilesCollectionUrl);

    const promise = model.findOneProfileByFiscalCode(aFiscalCode);

    return expect(promise).resolves.toEqual(null);
  });

});

describe("createProfile", () => {

  it("should create a new profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, cb) => {
        cb(null, {
          ...newDocument,
        });
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: IProfile = {
      fiscalCode: aFiscalCode,
    };

    const result = await model.createProfile(newProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.fiscalCode).toEqual(newProfile.fiscalCode);
    expect(result.id).toEqual(`${aFiscalCode}-${"0".repeat(16)}`);
    expect(result.version).toEqual(0);
  });

  it("should reject the promise in case of error", () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, cb) => {
        cb("error");
      }),
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: IProfile = {
      fiscalCode: aFiscalCode,
    };

    const promise = model.createProfile(newProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    return expect(promise).rejects.toEqual("error");
  });

});

describe("updateProfile", () => {

  it("should update an existing profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, cb) => {
        cb(null, {
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

    expect(result.fiscalCode).toEqual(pendingProfile.fiscalCode);
    expect(result.id).toEqual(`${aFiscalCode}-${"0".repeat(15)}1`);
    expect(result.version).toEqual(1);
  });

  it("should reject the promise in case of error", () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, cb) => {
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

    const promise = model.updateProfile(pendingProfile);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    return expect(promise).rejects.toEqual("error");
  });

});
