// tslint:disable:no-any

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";
import { toNonNegativeNumber } from "../../utils/numbers";
import { toNonEmptyString } from "../../utils/strings";

import {
  IRetrievedService,
  IService,
  ServiceModel,
  toAuthorizedRecipientsSet
} from "../service";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb");
const servicesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  "services"
);

const aServiceId = "xyz";

const aRetrievedService: IRetrievedService = {
  _self: "xyz",
  _ts: "xyz",
  authorizedRecipients: toAuthorizedRecipientsSet([]),
  departmentName: toNonEmptyString("MyDept").get,
  id: toNonEmptyString("xyz").get,
  kind: "IRetrievedService",
  organizationName: toNonEmptyString("MyOrg").get,
  serviceId: toNonEmptyString(aServiceId).get,
  serviceName: toNonEmptyString("MyService").get,
  version: toNonNegativeNumber(0).get
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

    const result = await model.findOneByServiceId(toNonEmptyString("id").get);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      expect(result.right.get).toEqual(aRetrievedService);
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

    const result = await model.findOneByServiceId(toNonEmptyString("id").get);

    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isEmpty).toBeTruthy();
    }
  });
});

describe("createService", () => {
  it("should create a new service", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument
        });
      })
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const newService: IService = {
      authorizedRecipients: toAuthorizedRecipientsSet([]),
      departmentName: toNonEmptyString("MyService").get,
      organizationName: toNonEmptyString("MyService").get,
      serviceId: toNonEmptyString(aServiceId).get,
      serviceName: toNonEmptyString("MyService").get
    };

    const result = await model.create(newService, newService.serviceId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aServiceId
    );
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.serviceId).toEqual(newService.serviceId);
      expect(result.right.id).toEqual(`${aServiceId}-${"0".repeat(16)}`);
      expect(result.right.version).toEqual(0);
    }
  });

  it("should resolve the promise to an error value in case of a query error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new ServiceModel(clientMock, servicesCollectionUrl);

    const newService: IService = {
      authorizedRecipients: toAuthorizedRecipientsSet([]),
      departmentName: toNonEmptyString("MyService").get,
      organizationName: toNonEmptyString("MyService").get,
      serviceId: toNonEmptyString(aServiceId).get,
      serviceName: toNonEmptyString("MyService").get
    };

    const result = await model.create(newService, newService.serviceId);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });
});

describe("update", () => {
  it("should update an existing service", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument
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
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.isDefined).toBeTruthy();
      const updatedService = result.right.get;
      expect(updatedService.serviceId).toEqual(aRetrievedService.serviceId);
      expect(updatedService.id).toEqual(`${aServiceId}-${"0".repeat(15)}1`);
      expect(updatedService.version).toEqual(1);
      expect(updatedService.serviceName).toEqual(aRetrievedService.serviceName);
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

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
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

    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left).toEqual("error");
    }
  });
});
