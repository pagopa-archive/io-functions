// tslint:disable:no-any

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { EmailString, NonEmptyString } from "../../utils/strings";

import { RetrievedProfile } from "../../models/profile";
import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { GetProfileHandler, UpsertProfileHandler } from "../profiles";

import { ExtendedProfile } from "../../api/definitions/ExtendedProfile";
import { FiscalCode } from "../../api/definitions/FiscalCode";
import { LimitedProfile } from "../../api/definitions/LimitedProfile";

import { NonNegativeNumber } from "../../utils/numbers";

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiLimitedProfileRead]),
  kind: "IAzureApiAuthorization",
  subscriptionId: "s123" as NonEmptyString,
  userId: "u123" as NonEmptyString
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aProfilePayloadMock = {
  email: "x@example.com"
};

const aRetrievedProfile: RetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: "x@example.com" as EmailString,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
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

    const response = await getProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
    );

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

    const response = await getProfileHandler(
      trustedAuth,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
    );
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

    const response = await getProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
    );
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

    const promise = getProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
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
      })
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const response = await upsertProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
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

  it("should update an existing profile (no conflict)", async () => {
    // tslint:disable-next-line:no-let
    let updatedProfile: any;

    const profileModelMock = {
      create: jest.fn(),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
      update: jest.fn((_, __, f) => {
        updatedProfile = f(aRetrievedProfile);
        return Promise.resolve(
          right(
            some({
              ...aRetrievedProfile,
              version: ((aRetrievedProfile.version as number) +
                1) as NonNegativeNumber
            })
          )
        );
      })
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const profilePayloadMock = {
      email: "y@example.com" as EmailString,
      version: aRetrievedProfile.version
    };

    const response = await upsertProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
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
      expect(response.value).toEqual({
        ...aPublicExtendedProfile,
        version: ((aRetrievedProfile.version as number) +
          1) as NonNegativeNumber
      });
    }
  });

  it("should update an existing profile (conflict)", async () => {
    const profileModelMock = {
      create: jest.fn(),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
      update: jest.fn()
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const profilePayloadMock = {
      email: "y@example.com" as EmailString,
      version: 0 as NonNegativeNumber
    };

    const response = await upsertProfileHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode,
      profilePayloadMock
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aRetrievedProfile.fiscalCode
    );
    expect(profileModelMock.create).not.toHaveBeenCalled();
    expect(profileModelMock.update).not.toHaveBeenCalled();
    expect(response.kind).toBe("IResponseErrorConflict");
  });
});
