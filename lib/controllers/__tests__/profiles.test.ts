// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { IRetrievedProfile } from "../../models/profile";
import { GetProfile, GetProfileHandler, UpsertProfile, UpsertProfileHandler } from "../profiles";

import { toFiscalCode } from "../../utils/fiscalcode";
import { toNonNegativeNumber } from "../../utils/numbers";

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aProfile: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: "x&example.com",
  fiscalCode: aFiscalCode,
  id: "123",
  version: toNonNegativeNumber(1).get,
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
        return Promise.resolve(aProfile);
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);
    const getProfile = GetProfile(getProfileHandler as any);

    const mockRequest = {
      params: {
        fiscalcode: aProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    getProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then(() => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(mockRequest.params.fiscalcode);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(aProfile);
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
        fiscalcode: aProfile.fiscalCode,
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
        fiscalcode: aProfile.fiscalCode,
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
        return Promise.resolve(aProfile);
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
        fiscalcode: aProfile.fiscalCode,
      },
    };

    const mockResponse = MockResponse();

    upsertProfile(mockRequest as any, mockResponse, null as any);

    return flushPromises().then((_) => {
      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aProfile.fiscalCode);
      expect(profileModelMock.createProfile).toHaveBeenCalledWith({
        email: "x@example.com",
        fiscalCode: aProfile.fiscalCode,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(aProfile);
    });

  });

});

it("should update an existing profile", () => {

  const profileModelMock = {
    createProfile: jest.fn(),
    findOneProfileByFiscalCode: jest.fn(() => {
      return Promise.resolve(aProfile);
    }),
    updateProfile: jest.fn(() => {
      return Promise.resolve(aProfile);
    }),
  };

  const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);
  const upsertProfile = UpsertProfile(upsertProfileHandler);

  const mockRequest = {
    body: {
      email: "y@example.com",
    },
    params: {
      fiscalcode: aProfile.fiscalCode,
    },
  };

  const mockResponse = MockResponse();

  upsertProfile(mockRequest as any, mockResponse, null as any);

  return flushPromises().then((_) => {
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aProfile.fiscalCode);
    expect(profileModelMock.createProfile).not.toHaveBeenCalled();
    expect(profileModelMock.updateProfile).toHaveBeenCalledWith({
      ...aProfile,
      email: "y@example.com",
    });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(aProfile);
  });

});
