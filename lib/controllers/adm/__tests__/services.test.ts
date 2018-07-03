/* tslint:disable:no-any */
/* tslint:disable:no-duplicate-string */

import { none, some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { Set } from "json-set-map";

import * as middlewares from "../../../utils/request_middleware";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../../utils/middlewares/azure_api_auth";

import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../../../models/service";

import { Service as ApiService } from "../../../api/definitions/Service";

import { MaxPaymentAmount } from "../../../api/definitions/MaxPaymentAmount";
import {
  CreateService,
  CreateServiceHandler,
  GetService,
  GetServiceHandler,
  ServicePayloadMiddleware,
  UpdateService,
  UpdateServiceHandler
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

const anOrganizationFiscalCode = "12345678901" as OrganizationFiscalCode;

const aServicePayload: ApiService = {
  authorized_cidrs: [],
  authorized_recipients: [],
  department_name: "MyDeptName" as NonEmptyString,
  organization_fiscal_code: anOrganizationFiscalCode,
  organization_name: "MyOrgName" as NonEmptyString,
  service_id: "MySubscriptionId" as NonEmptyString,
  service_name: "MyServiceName" as NonEmptyString
};

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

const aSeralizedService: ApiService = {
  ...aServicePayload,
  id: "123" as NonEmptyString,
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

describe("GetService", () => {
  it("should set up middlewares", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    GetService({} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
  });
});

describe("CreateServiceHandler", () => {
  it("should create a new service", async () => {
    const serviceModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(right(aRetrievedService));
      }),
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const createServiceHandler = CreateServiceHandler(serviceModelMock as any);

    const response = await createServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload
    );

    expect(serviceModelMock.create).toHaveBeenCalledWith(
      aService,
      aServicePayload.service_id
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aSeralizedService);
    }
  });
  it("should fail on errors during create", async () => {
    const serviceModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };
    const createServiceHandler = CreateServiceHandler(serviceModelMock as any);
    const response = await createServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload
    );
    expect(serviceModelMock.create).toHaveBeenCalledWith(
      aService,
      aServicePayload.service_id
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
});

describe("CreateService", () => {
  it("should set up middlewares", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    CreateService({} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateServiceHandler", () => {
  it("should update an existing service", async () => {
    const serviceModelMock = {
      create: jest.fn(),
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      }),
      update: jest.fn((_, __, f) => {
        const updatedService = f(aRetrievedService);
        return Promise.resolve(right(some(updatedService)));
      })
    };

    const updateServiceHandler = UpdateServiceHandler(serviceModelMock as any);
    const aDepartmentName = "UpdateDept" as NonEmptyString;
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      {
        ...aServicePayload,
        department_name: aDepartmentName
      }
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(serviceModelMock.update).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual({
        ...aSeralizedService,
        department_name: aDepartmentName
      });
    }
  });
  it("should fail if payload.serviceId differs from request.serviceId", async () => {
    const updateServiceHandler = UpdateServiceHandler({} as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      {
        ...aServicePayload,
        service_id: ((aServicePayload.service_id as string) +
          "x") as NonEmptyString
      }
    );
    expect(response.kind).toBe("IResponseErrorValidation");
  });
  it("should fail on query error", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };
    const updateServiceHandler = UpdateServiceHandler(serviceModelMock as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      aServicePayload
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
  it("should fail if existing service is not found", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };
    const updateServiceHandler = UpdateServiceHandler(serviceModelMock as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      aServicePayload
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });
  it("should fail on errors during update", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      }),
      update: jest.fn((_, __, ___) => {
        return Promise.resolve(left(none));
      })
    };
    const updateServiceHandler = UpdateServiceHandler(serviceModelMock as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      aServicePayload
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(serviceModelMock.update).toHaveBeenCalledWith(
      aRetrievedService.id,
      aRetrievedService.serviceId,
      expect.anything()
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
  it("should fail on empty service after update", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      }),
      update: jest.fn((_, __, ___) => {
        return Promise.resolve(right(none));
      })
    };
    const updateServiceHandler = UpdateServiceHandler(serviceModelMock as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.service_id,
      aServicePayload
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(serviceModelMock.update).toHaveBeenCalledWith(
      aRetrievedService.id,
      aRetrievedService.serviceId,
      expect.anything()
    );
    expect(response.kind).toBe("IResponseErrorInternal");
  });
});

describe("UpdateService", () => {
  it("should set up middlewares", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    UpdateService({} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
  });
});

describe("ServicePayloadMiddleware", () => {
  it("should extract the service payload from request", async () => {
    const errorOrServicePayload = await ServicePayloadMiddleware({
      body: aServicePayload
    } as any);
    expect(isRight(errorOrServicePayload)).toBeTruthy();
    expect(errorOrServicePayload.value).toEqual({
      ...aServicePayload,
      max_payment_amount: 0
    });
  });

  it("should fail if request payload does not validate", async () => {
    const errorOrServicePayload = await ServicePayloadMiddleware({
      body: { ...aServicePayload, max_payment_amount: 99999999999999 }
    } as any);
    expect(isLeft(errorOrServicePayload)).toBeTruthy();
    if (isLeft(errorOrServicePayload)) {
      expect(errorOrServicePayload.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
