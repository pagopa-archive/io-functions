// tslint:disable:no-any

import { none, some } from "ts-option";

import { right } from "../../../utils/either";
import { toNonNegativeNumber } from "../../../utils/numbers";
import { toNonEmptyString } from "../../../utils/strings";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../../utils/middlewares/azure_api_auth";

import {
  IRetrievedService,
  ISerializableService
} from "../../../models/service";
import {} from "../adm/services";

import {
  CreateServiceHandler,
  ServicePayloadMiddleware,
  UpdateServiceHandler
} from "../services";

const anAzureAuthorization: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiServiceWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: toNonEmptyString("s123").get,
  userId: toNonEmptyString("u123").get
};

const aServicePayloadMock: ISerializableService = {
  authorizedRecipients: [],
  departmentName: toNonEmptyString("MyDeptName").get,
  organizationName: toNonEmptyString("MyOrgName").get,
  serviceId: toNonEmptyString("MySubscriptionId").get,
  serviceName: toNonEmptyString("MyServiceName").get
};

const aRetrievedService: IRetrievedService = {
  _self: "123",
  _ts: "123",
  authorizedRecipients: [],
  departmentName: toNonEmptyString("MyDeptName").get,
  id: toNonEmptyString("123").get,
  kind: "IRetrievedService",
  organizationName: toNonEmptyString("MyOrgName").get,
  serviceId: toNonEmptyString("MySubscriptionId").get,
  serviceName: toNonEmptyString("MyServiceName").get,
  version: toNonNegativeNumber(1).get
};

describe("CreateService", () => {
  it("should create a new service", async () => {
    const serviceModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(right(aRetrievedService));
      }),
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const updateServiceHandler = CreateServiceHandler(serviceModelMock as any);

    const response = await updateServiceHandler(
      anAzureAuthorization,
      aServicePayloadMock
    );

    // expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
    //   aServicePayloadMock.serviceId
    // );

    expect(serviceModelMock.create).toHaveBeenCalledWith(
      aServicePayloadMock,
      aServicePayloadMock.serviceId
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aRetrievedService);
    }
  });
});

describe("UpdateService", () => {
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
      aServicePayloadMock.serviceId,
      {
        ...aServicePayloadMock,
        departmentName: toNonEmptyString(aDepartmentName).get
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
        departmentName: toNonEmptyString(aDepartmentName).get
      });
    }
  });
});

// describe("ServicePayloadMiddleware", () => {
//   it("should extract the service payload from request", async () => {
//     const aRequestBody = {
//       authorized_recipients: [],
//       department_name: toNonEmptyString("").get,
//       organization_name: toNonEmptyString("").get,
//       service_id: toNonEmptyString("").get,
//       service_name: toNonEmptyString("").get
//     };
//     ServicePayloadMiddleware({ body: aRequestBody });
//   });
// });
