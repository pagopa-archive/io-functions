/* tslint:disable:no-any */
/* tslint:disable:no-duplicate-string */

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";

import { RetrievedProfile } from "../../models/profile";
import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import {
  GetProfileHandler,
  isSenderAllowed,
  UpsertProfileHandler
} from "../profiles";

import { ExtendedProfile } from "../../api/definitions/ExtendedProfile";
import { FiscalCode } from "../../api/definitions/FiscalCode";
import { LimitedProfile } from "../../api/definitions/LimitedProfile";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { BlockedInboxOrChannelEnum } from "../../api/definitions/BlockedInboxOrChannel";
import { ServiceId } from "../../api/definitions/ServiceId";

const aServiceId = "s123" as ServiceId;

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiLimitedProfileRead]),
  kind: "IAzureApiAuthorization",
  subscriptionId: aServiceId,
  userId: "u123" as NonEmptyString
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aProfilePayloadMock = {
  email: "x@example.com"
};

const aRetrievedProfile: RetrievedProfile = {
  _self: "123",
  _ts: 123,
  acceptedTosVersion: 1 as NonNegativeNumber,
  email: "x@example.com" as EmailString,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
};

const aPublicExtendedProfile: ExtendedProfile = {
  accepted_tos_version: aRetrievedProfile.acceptedTosVersion,
  email: aRetrievedProfile.email,
  is_inbox_enabled: false,
  is_webhook_enabled: false,
  version: aRetrievedProfile.version
};

const aPublicLimitedProfile: LimitedProfile = {
  sender_allowed: true
};

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
      undefined as any,
      { service: { serviceId: aServiceId } } as any,
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

  it("should return sender_allowed: false if the user has blocked the sender service", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(
          right(
            some({
              ...aRetrievedProfile,
              blockedInboxOrChannels: { [aServiceId]: new Set(["INBOX"]) }
            })
          )
        );
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(
      anAzureAuthorization,
      undefined as any,
      { service: { serviceId: aServiceId } } as any,
      aFiscalCode
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual({
        sender_allowed: false
      });
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
      undefined as any,
      { service: { serviceId: aServiceId } } as any,
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
      undefined as any,
      undefined as any,
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
      undefined as any,
      { service: { serviceId: aServiceId } } as any,
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
      { bindings: {} } as any,
      anAzureAuthorization,
      undefined as any,
      undefined as any,
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
      is_inbox_enabled: false,
      is_webhook_enabled: false,
      tos_version: 1,
      version: aRetrievedProfile.version
    };

    const response = await upsertProfileHandler(
      { bindings: {} } as any,
      anAzureAuthorization,
      undefined as any,
      undefined as any,
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
      is_inbox_enabled: false,
      is_webhook_enabled: false,
      tos_version: 1,
      version: 0 as NonNegativeNumber
    };

    const response = await upsertProfileHandler(
      { bindings: {} } as any,
      anAzureAuthorization,
      undefined as any,
      undefined as any,
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

describe("isSenderAllowed", () => {
  it("should return false if the user has blocked the service", async () => {
    const ret = isSenderAllowed(
      {
        [aServiceId]: new Set(["INBOX"]) as ReadonlySet<
          BlockedInboxOrChannelEnum
        >
      },
      aServiceId
    );
    expect(ret).toBeFalsy();
  });
  it("should return true if the user has not blocked the service", async () => {
    const ret = isSenderAllowed(
      {
        [`${aServiceId}foo`]: new Set(["INBOX"]) as ReadonlySet<
          BlockedInboxOrChannelEnum
        >
      },
      aServiceId
    );
    expect(ret).toBeTruthy();
  });
});
