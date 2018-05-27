import * as ApplicationInsights from "applicationinsights";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ServiceId } from "../api/definitions/ServiceId";

export interface ITelemetryParams {
  readonly operationId: NonEmptyString;
  readonly operationParentId?: NonEmptyString;
  readonly serviceId?: ServiceId;
}

export function getApplicationInsightsTelemetryClient(
  params: ITelemetryParams,
  commonProperties?: Record<string, string>
): ApplicationInsights.TelemetryClient {
  const telemetryClient = new ApplicationInsights.TelemetryClient();
  // tslint:disable-next-line:no-object-mutation
  telemetryClient.context.keys.operationId = params.operationId;
  if (params.serviceId) {
    // tslint:disable-next-line:no-object-mutation
    telemetryClient.context.keys.userAccountId = params.serviceId;
  }
  if (params.operationParentId) {
    // tslint:disable-next-line:no-object-mutation
    telemetryClient.context.keys.operationParentId = params.operationParentId;
  }
  if (commonProperties) {
    // tslint:disable-next-line:no-object-mutation
    telemetryClient.commonProperties = commonProperties;
  }
  return telemetryClient;
}
