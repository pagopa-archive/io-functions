/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */
process.env = {
  ...process.env,
  COSMOSDB_NAME: "xxx",
  CUSTOMCONNSTR_COSMOSDB_KEY: "xxx",
  CUSTOMCONNSTR_COSMOSDB_URI: "xxx"
};

jest.mock("winston");
jest.mock("../utils/logging");

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";
import {
  RetrievedService,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../../lib/models/service";
import { MaxAllowedPaymentAmount } from "../api/definitions/MaxAllowedPaymentAmount";
import { index } from "../compute_visible_services";
import { VisibleService } from "../models/visible_service";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const aServiceId = "xyz" as NonEmptyString;
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aRetrievedService: RetrievedService = {
  _self: "xyz",
  _ts: 123,
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  id: "xyz" as NonEmptyString,
  isVisible: true,
  kind: "IRetrievedService",
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrg" as NonEmptyString,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString,
  version: 0 as NonNegativeNumber
};

const aRetrievedInvisibleService: RetrievedService = {
  ...aRetrievedService,
  isVisible: false
};

const aVisibleService: VisibleService = {
  departmentName: aRetrievedService.departmentName,
  id: aRetrievedService.id,
  organizationFiscalCode: aRetrievedService.organizationFiscalCode,
  organizationName: aRetrievedService.organizationName,
  serviceId: aRetrievedService.serviceId,
  serviceName: aRetrievedService.serviceName,
  version: aRetrievedService.version
};

describe("computeVisibleServices", () => {
  it("should extract visible services from a collection of services", async () => {
    const collectionIteratorSpy = jest
      .spyOn(ServiceModel.prototype, "getCollectionIterator")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(
              Promise.resolve(
                right(some([aRetrievedService, aRetrievedInvisibleService]))
              )
            )
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const ret = await index({} as any);
    expect(collectionIteratorSpy).toHaveBeenCalledTimes(1);
    expect(ret).toEqual({
      visibleServicesBlob: {
        [aRetrievedService.serviceId]: aVisibleService
      }
    });
  });

  it("should take the latest version of a service", async () => {
    const collectionIteratorSpy = jest
      .spyOn(ServiceModel.prototype, "getCollectionIterator")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(
              Promise.resolve(
                right(
                  some([
                    aRetrievedService,
                    { ...aRetrievedService, version: 1, isVisible: false },
                    aRetrievedInvisibleService
                  ])
                )
              )
            )
            .mockReturnValueOnce(Promise.resolve(right(none)))
        })
      );
    const ret = await index({} as any);
    expect(collectionIteratorSpy).toHaveBeenCalledTimes(1);
    expect(ret).toEqual({
      visibleServicesBlob: {}
    });
  });

  it("should exit on error querying the collection", async () => {
    const collectionIteratorSpy = jest
      .spyOn(ServiceModel.prototype, "getCollectionIterator")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(Promise.resolve(left(Error("error"))))
        })
      );
    const ret = await index({} as any);
    expect(collectionIteratorSpy).toHaveBeenCalledTimes(1);
    expect(ret).toBeUndefined();
  });

  it("should exit without bindings on any error", async () => {
    jest
      .spyOn(ServiceModel.prototype, "getCollectionIterator")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest.fn().mockRejectedValueOnce({})
        })
      );
    const ret = await index({} as any);
    expect(ret).toBeUndefined();
  });
});
