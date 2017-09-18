// tslint:disable:no-any

import { none, some } from "ts-option";
import { right } from "../../utils/either";
import { toNonEmptyString } from "../../utils/strings";

import {
  IPublicExtendedProfile,
  IPublicLimitedProfile,
  IRetrievedProfile,
} from "../../models/profile";
import { IAzureApiAuthorization, UserGroup } from "../../utils/middlewares/azure_api_auth";
import { GetProfileHandler, UpsertProfileHandler } from "../profiles";

import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { toNonNegativeNumber } from "../../utils/numbers";

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiLimitedProfileRead]),
  kind: "IAzureApiAuthorization",
};

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const aProfilePayloadMock = {
  email: "x@example.com",
};

const aRetrievedProfile: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: toNonEmptyString("x&example.com").get,
  fiscalCode: aFiscalCode,
  id: toNonEmptyString("123").get,
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

describe("GetProfileHandler", () => {

  it("should find an existing profile", async () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aFiscalCode);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicLimitedProfile);
    }

  });

  it("should return an extended profile to trusted applications", async () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const trustedAuth = {
      ...anAzureAuthorization,
      groups: new Set([UserGroup.ApiFullProfileRead]),
    };

    const response = await getProfileHandler(
      trustedAuth,
      aFiscalCode,
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aFiscalCode);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicExtendedProfile);
    }

  });

  it("should respond with NotFound if profile does not exist", async () => {

    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      }),
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aFiscalCode);
    expect(response.kind).toBe("IResponseErrorNotFound");

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

    return expect(promise).rejects.toBe("error");
  });

});

describe("UpsertProfile", () => {

  it("should create a new profile", async () => {

    const profileModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(right(aRetrievedProfile));
      }),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      }),
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const response = await upsertProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
      aProfilePayloadMock as any,
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
    expect(profileModelMock.create).toHaveBeenCalledWith({
      email: "x@example.com",
      fiscalCode: aRetrievedProfile.fiscalCode,
    }, aRetrievedProfile.fiscalCode);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicExtendedProfile);
    }

  });

});

it("should update an existing profile", async () => {

  // tslint:disable-next-line:no-let
  let updatedProfile;

  const profileModelMock = {
    create: jest.fn(),
    findOneProfileByFiscalCode: jest.fn(() => {
      return Promise.resolve(right(some(aRetrievedProfile)));
    }),
    update: jest.fn((_, __, f) => {
      updatedProfile = f(aRetrievedProfile);
      return Promise.resolve(right(some(aRetrievedProfile)));
    }),
  };

  const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

  const profilePayloadMock = {
    email: toNonEmptyString("y@example.com").get,
  };

  const response = await upsertProfileHandler(
    anAzureAuthorization,
    aFiscalCode,
    profilePayloadMock,
  );
  expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aRetrievedProfile.fiscalCode);
  expect(profileModelMock.create).not.toHaveBeenCalled();
  expect(profileModelMock.update).toHaveBeenCalledTimes(1);
  expect(updatedProfile.email).toBe("y@example.com");
  expect(response.kind).toBe("IResponseSuccessJson");
  if (response.kind === "IResponseSuccessJson") {
    expect(response.value).toEqual(aPublicExtendedProfile);
  }

});
