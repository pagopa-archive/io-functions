import * as ApplicationInsights from "applicationinsights";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ServiceId } from "../api/definitions/ServiceId";

export interface ITelemetryParams {
  readonly operationId: NonEmptyString;
  readonly operationParentId?: NonEmptyString;
  readonly serviceId?: ServiceId;
}

/**
 * Get a new ApplicationInsights TelemetryClient.
 *
 * When using context and/or commonProperties
 * the TelemetryClient shares them between all threads
 * (ie. function handlers runs). That's why we must obtain
 * a new instance every time we want to set common values
 * which are valid only for one run.
 */
export function createApplicationInsightsTelemetryClient(
  isProduction: boolean,
  params: ITelemetryParams,
  commonProperties?: Record<string, string>
): ApplicationInsights.TelemetryClient {
  const telemetryClient = new ApplicationInsights.TelemetryClient();
  const tags = telemetryClient.context.tags;
  const keys = telemetryClient.context.keys;
  // tslint:disable-next-line:no-object-mutation
  tags[keys.operationId] = params.operationId;
  if (params.serviceId) {
    // tslint:disable-next-line:no-object-mutation
    tags[keys.userAccountId] = params.serviceId;
  }
  if (params.operationParentId) {
    // tslint:disable-next-line:no-object-mutation
    tags[keys.operationParentId] = params.operationParentId;
  }
  if (commonProperties) {
    // tslint:disable-next-line:no-object-mutation
    telemetryClient.commonProperties = commonProperties;
  }
  if (isProduction) {
    // this won't disable manual calls to trackEvent / trackDependency
    ApplicationInsights.Configuration.setAutoCollectConsole(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectRequests(false)
      .setInternalLogging(false);
  }
  return telemetryClient;
}
