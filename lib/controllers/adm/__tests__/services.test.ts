// tslint:disable:no-any

import * as t from "io-ts";

import { none, Option, some, Some } from "fp-ts/lib/Option";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "../../../utils/numbers";
import { NonEmptyString } from "../../../utils/strings";

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
  subscriptionId: _getO(t.validate("s123", NonEmptyString).toOption()),
  userId: _getO(t.validate("u123", NonEmptyString).toOption())
};

const aServicePayload: ApiService = {
  authorized_cidrs: [],
  authorized_recipients: [],
  department_name: _getO(t.validate("MyDeptName", NonEmptyString).toOption()),
  organization_name: _getO(t.validate("MyOrgName", NonEmptyString).toOption()),
  service_id: _getO(t.validate("MySubscriptionId", NonEmptyString).toOption()),
  service_name: _getO(t.validate("MyServiceName", NonEmptyString).toOption())
};

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: _getO(t.validate("MyDeptName", NonEmptyString).toOption()),
  organizationName: _getO(t.validate("MyOrgName", NonEmptyString).toOption()),
  serviceId: _getO(t.validate("MySubscriptionId", NonEmptyString).toOption()),
  serviceName: _getO(t.validate("MyServiceName", NonEmptyString).toOption())
};

const aNewService: NewService = {
  ...aService,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  kind: "INewService",
  version: _getO(t.validate(1, NonNegativeNumber).toOption())
};

const aRetrievedService: RetrievedService = {
  ...aNewService,
  _self: "123",
  _ts: "123",
  kind: "IRetrievedService"
};

const aSeralizedService: ApiService = {
  ...aServicePayload,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  version: _getO(t.validate(1, NonNegativeNumber).toOption())
};

describe("GetServiceHandler", () => {
  it("should get an existing service", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      })
    };
    const aServiceId = _getO(t.validate("1", NonEmptyString).toOption());
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
    const aServiceId = _getO(t.validate("1", NonEmptyString).toOption());
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
    const aServiceId = _getO(t.validate("1", NonEmptyString).toOption());
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
      aServicePayload.service_id,
      {
        ...aServicePayload,
        department_name: _getO(
          t.validate(aDepartmentName, NonEmptyString).toOption()
        )
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
        department_name: _getO(
          t.validate(aDepartmentName, NonEmptyString).toOption()
        )
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
        service_id: _getO(
          t
            .validate(aServicePayload.service_id + "x", NonEmptyString)
            .toOption()
        )
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
    jest.clearAllMocks();
    jest.resetAllMocks();
  });
});

describe("ServicePayloadMiddleware", () => {
  it("should extract the service payload from request", async () => {
    const errorOrServicePayload = await ServicePayloadMiddleware({
      body: aServicePayload
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
