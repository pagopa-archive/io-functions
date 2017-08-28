// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { IPublicExtendedProfile, IPublicLimitedProfile, IRetrievedProfile } from "../../models/profile";
import { GetProfile, GetProfileHandler, UpsertProfile, UpsertProfileHandler } from "../profiles";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

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

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("GetProfile", () => {

  it("should validate the provided fiscal code", () => {
    const getProfileHandler = jest.fn();
    const getProfile = GetProfile(getProfileHandler);

    const mockRequest = {
      params: {
        fiscalcode: "not valid",
      },
    };

    const mockResponse = MockResponse();

    getProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(getProfileHandler).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  it("should find an existing profile", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(aRetrievedProfile);
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);
    const getProfile = GetProfile(getProfileHandler as any);

    const mockRequest = {
      params: {
        fiscalcode: aRetrievedProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    getProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(mockRequest.params.fiscalcode);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(aPublicLimitedProfile);
    });

  });

  it("should respond with 404 if profile does not exist", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(null);
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);
    const getProfile = GetProfile(getProfileHandler as any);

    const mockRequest = {
      params: {
        fiscalcode: aRetrievedProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    getProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(mockRequest.params.fiscalcode);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

  });

  it("should return errors", () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.reject("error");
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);
    const getProfile = GetProfile(getProfileHandler as any);

    const mockRequest = {
      params: {
        fiscalcode: aRetrievedProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    getProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(mockRequest.params.fiscalcode);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

  });

});

describe("UpsertProfile", () => {

  it("should validate the provided fiscal code", () => {

    const upsertProfileHandler = jest.fn();
    const upsertProfile = UpsertProfile(upsertProfileHandler);

    const mockRequest = {
      params: {
        fiscalcode: "not valid",
      },
    };

    const mockResponse = MockResponse();

    upsertProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(upsertProfileHandler).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

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
    const upsertProfile = UpsertProfile(upsertProfileHandler);

    const mockRequest = {
      body: {
        email: "x@example.com",
      },
      params: {
        fiscalcode: aRetrievedProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    upsertProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then((_) => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
      expect(profileModelMock.createProfile).toHaveBeenCalledWith({
        email: "x@example.com",
        fiscalCode: aRetrievedProfile.fiscalCode,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(aPublicExtendedProfile);
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
  const upsertProfile = UpsertProfile(upsertProfileHandler);

  const mockRequest = {
    body: {
      email: "y@example.com",
    },
    params: {
      fiscalcode: aRetrievedProfile.fiscalCode,
    },
  };

  const mockResponse = MockResponse();

  upsertProfile(mockRequest as any, mockResponse, null as any);

  return flushPromises().then((_) => {
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
    expect(profileModelMock.createProfile).not.toHaveBeenCalled();
    expect(profileModelMock.updateProfile).toHaveBeenCalledWith({
      ...aRetrievedProfile,
      email: "y@example.com",
    });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(aPublicExtendedProfile);
  });

});
