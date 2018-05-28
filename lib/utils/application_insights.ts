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
export function getApplicationInsightsTelemetryClientCreator(
  isProduction: boolean
): (
  params: ITelemetryParams,
  commonProperties?: Record<string, string>
) => ApplicationInsights.TelemetryClient {
  // TODO: [#157915000] the following call is expensive, refactor using correlation context:
  // see https://github.com/Microsoft/ApplicationInsights-node.js/issues/387#issuecomment-383648111
  const telemetryClient = new ApplicationInsights.TelemetryClient();
  if (isProduction) {
    // this won't disable manual calls to trackEvent / trackDependency
    ApplicationInsights.Configuration.setAutoCollectConsole(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectRequests(false)
      .setInternalLogging(false);
  }
  return (params, commonProperties) => {
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
    return telemetryClient;
  };
}

const NANOSEC_PER_MILLISEC = 1e6;
const MILLISEC_PER_SEC = 1e3;

/**
 * Small helper function that gets the difference in milliseconds
 * from an initial time obtained calling process.hrtime().
 * Used when profiling code.
 */
export function diffInMilliseconds(startHrtime: [number, number]): number {
  const diff = process.hrtime(startHrtime);
  return diff[0] * MILLISEC_PER_SEC + diff[1] / NANOSEC_PER_MILLISEC;
}
