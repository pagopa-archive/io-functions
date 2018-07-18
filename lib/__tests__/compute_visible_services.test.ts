// tslint:disable
// jest.mock("../../lib/utils/documentdb");
// jest.mock("../../lib/models/service");
// import * as documentDbUtils from "../../lib/utils/documentdb";

process.env = {
  ...process.env,
  CUSTOMCONNSTR_COSMOSDB_URI: "xxx",
  CUSTOMCONNSTR_COSMOSDB_KEY: "xxx",
  COSMOSDB_NAME: "xxx"
};

jest.mock("winston");
jest.mock("../utils/logging");

import { index } from "../compute_visible_services";
import { right, left } from "fp-ts/lib/Either";
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
import { VisibleService } from "../models/visible_service";

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
  organizationFiscalCode: aRetrievedService.organizationFiscalCode,
  id: aRetrievedService.id,
  organizationName: aRetrievedService.organizationName,
  serviceId: aRetrievedService.serviceId,
  serviceName: aRetrievedService.serviceName,
  version: aRetrievedService.version
};

describe("computeVisibleServices", () => {
  it("should extract visible services from a collection of services", async () => {
    jest
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
    // tslint:disable-next-line:no-any
    const ret = await index({} as any);
    expect(ret).toEqual({
      visibleServicesBlob: {
        [aRetrievedService.serviceId]: aVisibleService
      }
    });
  });

  it("should take the latest version of a service", async () => {
    jest
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
    // tslint:disable-next-line:no-any
    const ret = await index({} as any);
    expect(ret).toEqual({
      visibleServicesBlob: {}
    });
  });

  it("should exit on error querying the collection", async () => {
    jest
      .spyOn(ServiceModel.prototype, "getCollectionIterator")
      .mockImplementation(() =>
        Promise.resolve({
          executeNext: jest
            .fn()
            .mockReturnValueOnce(Promise.resolve(left(Error("error"))))
        })
      );
    // tslint:disable-next-line:no-any
    const ret = await index({} as any);
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
    // tslint:disable-next-line:no-any
    const ret = await index({} as any);
    expect(ret).toBeUndefined();
  });
});
