/* tslint:disable:no-any */
/* tslint:disable:no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";
import { NonNegativeNumber } from "../../utils/numbers";
import { NonEmptyString } from "../../utils/strings";

import {
  RetrievedService,
  Service,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../service";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const servicesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "services"
);

const aServiceId = "xyz" as NonEmptyString;

const aRetrievedService: RetrievedService = {
  _self: "xyz",
  _ts: "xyz",
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedService",
  organizationName: "MyOrg" as NonEmptyString,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString,
  version: 0 as NonNegativeNumber
};

const aSerializedService = {
  ...aRetrievedService,
  authorizedRecipients: []
};

describe("findOneServiceById", () => {
  it("should resolve a promise to an existing service", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [aSerializedService], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new ServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      servicesCollectionUrl
    );

    const result = await model.findOneByServiceId("id" as NonEmptyString);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedService);
    }
  });

  it("should resolve a promise to an empty value if no service is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new ServiceModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      servicesCollectionUrl
    );

    const result = await model.findOneByServiceId("id" as NonEmptyString);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("createService", () => {
  it("should create a new service", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: "123"
        });
      })
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const newService: Service = {
      authorizedCIDRs: toAuthorizedCIDRs([]),
      authorizedRecipients: toAuthorizedRecipients([]),
      departmentName: "MyService" as NonEmptyString,
      organizationName: "MyService" as NonEmptyString,
      serviceId: aServiceId,
      serviceName: "MyService" as NonEmptyString
    };

    const result = await model.create(newService, newService.serviceId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aServiceId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.serviceId).toEqual(newService.serviceId);
      expect(result.value.id).toEqual(`${aServiceId}-${"0".repeat(16)}`);
      expect(result.value.version).toEqual(0);
    }
  });

  it("should resolve the promise to an error value in case of a query error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const newService: Service = {
      authorizedCIDRs: toAuthorizedCIDRs([]),
      authorizedRecipients: toAuthorizedRecipients([]),
      departmentName: "MyService" as NonEmptyString,
      organizationName: "MyService" as NonEmptyString,
      serviceId: aServiceId,
      serviceName: "MyService" as NonEmptyString
    };

    const result = await model.create(newService, newService.serviceId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("update", () => {
  it("should update an existing service", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: "123"
        });
      }),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedService))
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const result = await model.update(
      aRetrievedService.id,
      aRetrievedService.serviceId,
      p => {
        return {
          ...p
        };
      }
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aServiceId
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedService = result.value.value;
        expect(updatedService.serviceId).toEqual(aRetrievedService.serviceId);
        expect(updatedService.id).toEqual(`${aServiceId}-${"0".repeat(15)}1`);
        expect(updatedService.version).toEqual(1);
        expect(updatedService.serviceName).toEqual(
          aRetrievedService.serviceName
        );
      }
    }
  });

  it("should resolve the promise to an error value in case of a readDocument error", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const result = await model.update(aServiceId, aServiceId, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should resolve the promise to an error value in case of a createDocument error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedService))
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const result = await model.update(aServiceId, aServiceId, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
