import * as ApplicationInsights from "applicationinsights";
import {
  Data,
  EventData
} from "applicationinsights/out/Declarations/Contracts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ServiceId } from "../api/definitions/ServiceId";

export interface ITelemetryParams {
  readonly operationId: NonEmptyString;
  readonly operationParentId?: NonEmptyString;
  readonly serviceId?: ServiceId;
}

/**
 * A TelemetryClient instance cannot be shared between track calls
 * as custom properties and tags (ie. operationId) are part
 * of a mutable shared state attached to the instance.
 *
 * This method returns a TelemetryClient with a custom
 * TelemetryProcessor that stores tags and properties
 * before any call to track(); in this way the returned
 * instance of the TelemetryClient can be shared safely.
 */
export function wrapCustomTelemetryClient(
  isTracingDisabled: boolean,
  client: ApplicationInsights.TelemetryClient
): (
  params: ITelemetryParams,
  commonProperties?: Record<string, string>
) => ApplicationInsights.TelemetryClient {
  if (isTracingDisabled) {
    // this won't disable manual calls to trackEvent / trackDependency
    ApplicationInsights.Configuration.setAutoCollectConsole(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectRequests(false)
      .setInternalLogging(false)
      // see https://stackoverflow.com/questions/49438235/application-insights-metric-in-aws-lambda/49441135#49441135
      .setUseDiskRetryCaching(false);
  }
  return (params, commonProperties) => {
    client.addTelemetryProcessor(env => {
      // tslint:disable-next-line:no-object-mutation
      env.tags = {
        ...env.tags,
        [client.context.keys.operationId]: params.operationId,
        [client.context.keys.operationParentId]: params.operationParentId,
        [client.context.keys.userAccountId]: params.serviceId
      };
      // cast needed due to https://github.com/Microsoft/ApplicationInsights-node.js/issues/392
      const data = env.data as Data<EventData>;
      // tslint:disable-next-line:no-object-mutation
      data.baseData.properties = {
        ...data.baseData.properties,
        ...commonProperties
      };
      // return true to execute the following telemetry processor
      return true;
    });
    return client;
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
