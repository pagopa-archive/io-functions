// tslint:disable:no-any

import { none, some } from "fp-ts/lib/Option";

import { left, right } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { response as MockResponse } from "jest-mock-express";

import * as middlewares from "../../utils/request_middleware";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import * as authMiddleware from "../../utils/middlewares/azure_api_auth";

import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../../models/service";

import { ServicePublic as ApiService } from "../../api/definitions/ServicePublic";

import { FiscalCode } from "../../api/definitions/FiscalCode";
import { MaxPaymentAmount } from "../../api/definitions/MaxPaymentAmount";
import {
  GetService,
  GetServiceHandler,
  GetServicesByRecipient,
  GetServicesByRecipientHandler
} from "../services";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiServiceWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: "s123" as NonEmptyString,
  userId: "u123" as NonEmptyString
};

const aServicePayload: ApiService = {
  department_name: "MyDeptName" as NonEmptyString,
  organization_name: "MyOrgName" as NonEmptyString,
  service_id: "MySubscriptionId" as NonEmptyString,
  service_name: "MyServiceName" as NonEmptyString
};

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const aFiscalCode = "SPNDNL80R13D000X" as FiscalCode;

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  maxPaymentAmount: 0 as MaxPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
  serviceId: "MySubscriptionId" as NonEmptyString,
  serviceName: "MyServiceName" as NonEmptyString
};

const aNewService: NewService = {
  ...aService,
  id: "123" as NonEmptyString,
  kind: "INewService",
  version: 1 as NonNegativeNumber
};

const aRetrievedService: RetrievedService = {
  ...aNewService,
  _self: "123",
  _ts: 123,
  kind: "IRetrievedService"
};

const someRetrievedServices: ReadonlyArray<any> = [
  aRetrievedService,
  { ...aRetrievedService, id: "124" }
];

const aSeralizedService: ApiService = {
  ...aServicePayload,
  version: 1 as NonNegativeNumber
};

describe("GetServiceHandler", () => {
  it("should get an existing service", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServiceId
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aSeralizedService);
    }
  });
  it("should fail on errors during get", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServiceId
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
  it("should return not found if the service does not exist", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServiceId
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });
});

describe("GetServicesByRecipientHandler", () => {
  it("should get id of the services that notified an existing recipient", async () => {
    const mockIterator = {
      executeNext: jest.fn()
    };
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some(someRetrievedServices)))
    );
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const senderServiceModelMock = {
      findSenderServicesForRecipient: jest.fn(() => mockIterator)
    };

    const getSenderServiceHandler = GetServicesByRecipientHandler(
      senderServiceModelMock as any
    );
    const response = await getSenderServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
    );
    response.apply(MockResponse());

    await Promise.resolve(); // needed to let the response promise complete
    expect(
      senderServiceModelMock.findSenderServicesForRecipient
    ).toHaveBeenCalledWith(aFiscalCode);
    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    expect(mockIterator.executeNext).toHaveBeenCalledTimes(2);
  });
});

describe("GetServicesByRecipient", () => {
  it("should set up authentication middleware", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    const authMiddlewaresSpy = jest
      .spyOn(authMiddleware, "AzureApiAuthMiddleware")
      .mockReturnValueOnce(jest.fn());
    GetServicesByRecipient({} as any, {} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
    expect(authMiddlewaresSpy).toHaveBeenCalledWith(
      new Set([UserGroup.ApiServiceByRecipientQuery])
    );
  });
});

describe("GetService", () => {
  it("should set up authentication middleware", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    const authMiddlewaresSpy = jest
      .spyOn(authMiddleware, "AzureApiAuthMiddleware")
      .mockReturnValueOnce(jest.fn());
    GetService({} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
    expect(authMiddlewaresSpy).toHaveBeenCalledWith(
      new Set([UserGroup.ApiPublicServiceRead])
    );
  });
});
