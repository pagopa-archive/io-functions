/* tslint:disable:no-any */

jest.mock("applicationinsights");
import * as applicationinsights from "applicationinsights";
import { NonEmptyString } from "io-ts-commons/lib/strings";
import { wrapCustomTelemetryClient } from "../application_insights";

const AiConfiguration = {
  setAutoCollectConsole: jest.fn().mockReturnThis(),
  setAutoCollectDependencies: jest.fn().mockReturnThis(),
  setAutoCollectPerformance: jest.fn().mockReturnThis(),
  setAutoCollectRequests: jest.fn().mockReturnThis(),
  setInternalLogging: jest.fn().mockReturnThis(),
  setUseDiskRetryCaching: jest.fn().mockReturnThis()
};

describe("wrapCustomTelemetryClient", () => {
  it("should return a customized TelemetryClient with a TelemetryProcessor", () => {
    const newTelemetryClient = new applicationinsights.TelemetryClient();
    const getTelemetryClient = wrapCustomTelemetryClient(
      false,
      newTelemetryClient
    );
    const telemetryClient = getTelemetryClient(
      {
        operationId: "operationId" as NonEmptyString,
        operationParentId: "parentId" as NonEmptyString,
        serviceId: "serviceId" as NonEmptyString
      },
      { prop: "true" }
    );

    const mockEnv = { data: { baseData: { properties: {} } } } as any;

    // tslint:disable-next-line:no-object-mutation
    telemetryClient.context = {
      keys: {
        operationId: "operationId",
        operationParentId: "oprationParentId",
        userAccountId: "userAccountId"
      } as any
    } as any;

    const processor = (telemetryClient.addTelemetryProcessor as jest.Mock).mock
      .calls[0][0];

    processor(mockEnv);

    expect(mockEnv.data.baseData.properties.prop).toEqual("true");
    expect(mockEnv.tags).toBeDefined();

    expect(telemetryClient).toBeInstanceOf(applicationinsights.TelemetryClient);
    expect(telemetryClient).toBe(newTelemetryClient);
    expect(telemetryClient.addTelemetryProcessor).toHaveBeenCalledTimes(1);
  });
  it("should change the default configuration when tracing is disable", () => {
    const configurationSpy = jest
      .spyOn(applicationinsights.Configuration, "setAutoCollectConsole")
      .mockReturnValue(AiConfiguration);
    const getTelemetryClient = wrapCustomTelemetryClient(
      true,
      new applicationinsights.TelemetryClient()
    );
    const telemetryClient = getTelemetryClient(
      {
        operationId: "operationId" as NonEmptyString,
        operationParentId: "parentId" as NonEmptyString,
        serviceId: "serviceId" as NonEmptyString
      },
      {}
    );
    expect(configurationSpy).toHaveBeenCalledTimes(1);
    expect(telemetryClient).toBeInstanceOf(applicationinsights.TelemetryClient);
  });
});
