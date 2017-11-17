// tslint:disable:no-any

import { none, Option, some, Some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { toNonNegativeNumber } from "../../../utils/numbers";
import { toNonEmptyString } from "../../../utils/strings";

import { Set } from "json-set-map";

import * as middlewares from "../../../utils/request_middleware";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../../utils/middlewares/azure_api_auth";

import {
  IRetrievedService,
  IService,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../../../models/service";

import {
  CreateService,
  CreateServiceHandler,
  GetService,
  GetServiceHandler,
  ServicePayloadMiddleware,
  UpdateService,
  UpdateServiceHandler
} from "../services";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiServiceWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: _getO(toNonEmptyString("s123")),
  userId: _getO(toNonEmptyString("u123"))
};

const aServicePayload: IService = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: _getO(toNonEmptyString("MyDeptName")),
  organizationName: _getO(toNonEmptyString("MyOrgName")),
  serviceId: _getO(toNonEmptyString("MySubscriptionId")),
  serviceName: _getO(toNonEmptyString("MyServiceName"))
};

const aRetrievedService: IRetrievedService = {
  _self: "123",
  _ts: "123",
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: _getO(toNonEmptyString("MyDeptName")),
  id: _getO(toNonEmptyString("123")),
  kind: "IRetrievedService",
  organizationName: _getO(toNonEmptyString("MyOrgName")),
  serviceId: _getO(toNonEmptyString("MySubscriptionId")),
  serviceName: _getO(toNonEmptyString("MyServiceName")),
  version: _getO(toNonNegativeNumber(1))
};

describe("GetServiceHandler", () => {
  it("should get an existing service", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      })
    };
    const aServiceId = _getO(toNonEmptyString("1"));
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
      expect(response.value).toEqual(aRetrievedService);
    }
  });
  it("should fail on errors during get", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };
    const aServiceId = _getO(toNonEmptyString("1"));
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
    const aServiceId = _getO(toNonEmptyString("1"));
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
    jest.clearAllMocks();
    jest.resetAllMocks();
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
      aServicePayload,
      aServicePayload.serviceId
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aRetrievedService);
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
      aServicePayload,
      aServicePayload.serviceId
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
    jest.clearAllMocks();
    jest.resetAllMocks();
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
    const aDepartmentName = "UpdateDept";
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.serviceId,
      {
        ...aServicePayload,
        departmentName: _getO(toNonEmptyString(aDepartmentName))
      }
    );
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aRetrievedService.serviceId
    );
    expect(serviceModelMock.update).toHaveBeenCalledTimes(1);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual({
        ...aRetrievedService,
        departmentName: _getO(toNonEmptyString(aDepartmentName))
      });
    }
  });
  it("should fail if payload.serviceId differs from request.serviceId", async () => {
    const updateServiceHandler = UpdateServiceHandler({} as any);
    const response = await updateServiceHandler(
      anAzureAuthorization,
      undefined as any, // not used
      undefined as any, // not used
      aServicePayload.serviceId,
      {
        ...aServicePayload,
        serviceId: _getO(toNonEmptyString(aServicePayload.serviceId + "x"))
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
      aServicePayload.serviceId,
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
      aServicePayload.serviceId,
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
      aServicePayload.serviceId,
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
      aServicePayload.serviceId,
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
    jest.clearAllMocks();
    jest.resetAllMocks();
  });
});

describe("ServicePayloadMiddleware", () => {
  it("should extract the service payload from request", async () => {
    const aRequestBody = {
      authorized_recipients: Array.from(aServicePayload.authorizedRecipients),
      department_name: aServicePayload.departmentName,
      organization_name: aServicePayload.organizationName,
      service_id: aServicePayload.serviceId,
      service_name: aServicePayload.serviceName
    };
    const errorOrServicePayload = await ServicePayloadMiddleware({
      body: aRequestBody
    } as any);
    expect(isRight(errorOrServicePayload)).toBeTruthy();
    expect(errorOrServicePayload.value).toEqual(aServicePayload);
  });
  it("should fail if request payload does not validate", async () => {
    const errorOrServicePayload = await ServicePayloadMiddleware({
      body: {}
    } as any);
    expect(isLeft(errorOrServicePayload)).toBeTruthy();
    if (isLeft(errorOrServicePayload)) {
      expect(errorOrServicePayload.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
