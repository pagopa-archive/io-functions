// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import {
  IPublicExtendedProfile,
  IPublicLimitedProfile,
  IRetrievedProfile,
} from "../../models/profile";
import { IAzureApiAuthorization, UserGroup } from "../../utils/middlewares/azure_api_auth";
import { GetProfileHandler, UpsertProfileHandler } from "../profiles";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.Developers]),
  kind: "IAzureApiAuthorization",
};

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aProfilePayloadMock = {
  email: "x@example.com",
};

const aRetrievedProfile: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: "x&example.com",
  fiscalCode: aFiscalCode,
  id: "123",
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(1).get,
};

const aPublicExtendedProfile: IPublicExtendedProfile = {
  email: aRetrievedProfile.email,
  fiscalCode: aRetrievedProfile.fiscalCode,
  kind: "IPublicExtendedProfile",
  version: aRetrievedProfile.version,
};

const aPublicLimitedProfile: IPublicLimitedProfile = {
  fiscalCode: aPublicExtendedProfile.fiscalCode,
  kind: "IPublicLimitedProfile",
};

function flushPromises<T>(): Promise<T> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("GetProfileHandler", () => {

  it("should find an existing profile", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(aRetrievedProfile);
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    return getProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
    ).then((response) => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aFiscalCode);
      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value).toEqual(aPublicLimitedProfile);
      }
    });

  });

  it("should respond with NotFound if profile does not exist", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(null);
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    getProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
    ).then((response) => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aFiscalCode);
      expect(response.kind).toBe("IResponseNotFound");
    });

  });

  it("should reject the promise in case of errors", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.reject("error");
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const promise = getProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
    );

    expect(promise).rejects.toBe("error");

  });

});

describe("UpsertProfile", () => {

  it("should create a new profile", () => {

    const profileModelMock = {
      createProfile: jest.fn(() => {
        return Promise.resolve(aRetrievedProfile);
      }),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(null);
      }),
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    upsertProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
      aProfilePayloadMock as any,
    ).then((response) => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
      expect(profileModelMock.createProfile).toHaveBeenCalledWith({
        email: "x@example.com",
        fiscalCode: aRetrievedProfile.fiscalCode,
      });
      expect(response.kind).toBe("IResponseSuccessJson");
      if (response.kind === "IResponseSuccessJson") {
        expect(response.value).toHaveBeenCalledWith(aPublicExtendedProfile);
      }
    });

  });

});

it("should update an existing profile", () => {

  const profileModelMock = {
    createProfile: jest.fn(),
    findOneProfileByFiscalCode: jest.fn(() => {
      return Promise.resolve(aRetrievedProfile);
    }),
    updateProfile: jest.fn(() => {
      return Promise.resolve(aRetrievedProfile);
    }),
  };

  const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

  const profilePayloadMock = {
    email: "y@example.com",
  };

  upsertProfileHandler(
    anAzureAuthorization,
    aFiscalCode,
    profilePayloadMock,
  ).then((response) => {
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
    expect(profileModelMock.createProfile).not.toHaveBeenCalled();
    expect(profileModelMock.updateProfile).toHaveBeenCalledWith({
      ...aRetrievedProfile,
      email: "y@example.com",
    });
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toHaveBeenCalledWith(aPublicExtendedProfile);
    }
  });

});
