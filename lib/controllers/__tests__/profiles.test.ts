// tslint:disable:no-any

import { right } from "fp-ts/lib/Either";
import { none, Option, some, Some } from "fp-ts/lib/Option";
import { toEmailString, toNonEmptyString } from "../../utils/strings";

import { IRetrievedProfile } from "../../models/profile";
import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { GetProfileHandler, UpsertProfileHandler } from "../profiles";

import { ExtendedProfile } from "../../api/definitions/ExtendedProfile";
import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { LimitedProfile } from "../../api/definitions/LimitedProfile";

import { toNonNegativeNumber } from "../../utils/numbers";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiLimitedProfileRead]),
  kind: "IAzureApiAuthorization",
  subscriptionId: _getO(toNonEmptyString("s123")),
  userId: _getO(toNonEmptyString("u123"))
};

const aFiscalCode = _getO(toFiscalCode("FRLFRC74E04B157I"));

const aProfilePayloadMock = {
  email: "x@example.com"
};

const aRetrievedProfile: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: _getO(toEmailString("x@example.com")),
  fiscalCode: aFiscalCode,
  id: _getO(toNonEmptyString("123")),
  kind: "IRetrievedProfile",
  version: _getO(toNonNegativeNumber(1))
};

const aPublicExtendedProfile: ExtendedProfile = {
  email: aRetrievedProfile.email,
  version: aRetrievedProfile.version
};

const aPublicLimitedProfile: LimitedProfile = {};

describe("GetProfileHandler", () => {
  it("should find an existing profile", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(anAzureAuthorization, aFiscalCode);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicLimitedProfile);
    }
  });

  it("should return an extended profile to trusted applications", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const trustedAuth = {
      ...anAzureAuthorization,
      groups: new Set([UserGroup.ApiFullProfileRead])
    };

    const response = await getProfileHandler(trustedAuth, aFiscalCode);
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicExtendedProfile);
    }
  });

  it("should respond with NotFound if profile does not exist", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(anAzureAuthorization, aFiscalCode);
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });

  it("should reject the promise in case of errors", () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.reject("error");
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const promise = getProfileHandler(anAzureAuthorization, aFiscalCode);

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
      })
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const response = await upsertProfileHandler(
      anAzureAuthorization,
      aFiscalCode,
      aProfilePayloadMock as any
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aRetrievedProfile.fiscalCode
    );
    expect(profileModelMock.create).toHaveBeenCalledWith(
      {
        email: "x@example.com",
        fiscalCode: aRetrievedProfile.fiscalCode
      },
      aRetrievedProfile.fiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicExtendedProfile);
    }
  });
});

it("should update an existing profile", async () => {
  // tslint:disable-next-line:no-let
  let updatedProfile: any;

  const profileModelMock = {
    create: jest.fn(),
    findOneProfileByFiscalCode: jest.fn(() => {
      return Promise.resolve(right(some(aRetrievedProfile)));
    }),
    update: jest.fn((_, __, f) => {
      updatedProfile = f(aRetrievedProfile);
      return Promise.resolve(right(some(aRetrievedProfile)));
    })
  };

  const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

  const profilePayloadMock = {
    email: _getO(toEmailString("y@example.com"))
  };

  const response = await upsertProfileHandler(
    anAzureAuthorization,
    aFiscalCode,
    profilePayloadMock
  );
  expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
    aRetrievedProfile.fiscalCode
  );
  expect(profileModelMock.create).not.toHaveBeenCalled();
  expect(profileModelMock.update).toHaveBeenCalledTimes(1);
  expect(updatedProfile.email).toBe("y@example.com");
  expect(response.kind).toBe("IResponseSuccessJson");
  if (response.kind === "IResponseSuccessJson") {
    expect(response.value).toEqual(aPublicExtendedProfile);
  }
});
