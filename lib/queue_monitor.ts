import * as winston from "winston";

import { TelemetryClient } from "applicationinsights";
import { IContext } from "azure-functions-types";
import { createQueueService } from "azure-storage";
import { MESSAGE_QUEUE_NAME } from "./created_message_queue_handler";
import { EMAIL_NOTIFICATION_QUEUE_NAME } from "./emailnotifications_queue_handler";
import { getRequiredStringEnv } from "./utils/env";
import { configureAzureContextTransport } from "./utils/logging";
import { WEBHOOK_NOTIFICATION_QUEUE_NAME } from "./webhook_queue_handler";

const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");
const queueService = createQueueService(queueConnectionString);

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

const appInsightsClient = new TelemetryClient();

// needed otherwise AI will wait for the batching loop to end
// see https://github.com/Microsoft/ApplicationInsights-node.js/issues/390
// tslint:disable-next-line:no-object-mutation
appInsightsClient.config.maxBatchSize = 1;

/**
 * A function to store the length of Azure Storage Queues
 * into Application Insights Metrics.
 *
 * To query these values in the Analytics panel type:
 *
 * customMetrics
 *   | where * has  "queue.length"
 *   | order by timestamp desc
 */
/* istanbul ignore next */
export function index(context: IContext): void {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  [
    EMAIL_NOTIFICATION_QUEUE_NAME,
    WEBHOOK_NOTIFICATION_QUEUE_NAME,
    MESSAGE_QUEUE_NAME
  ].forEach(queueName =>
    queueService.getQueueMetadata(queueName, (error, result) => {
      if (error) {
        winston.error("Error in QueueMonitor: %s (%s)", error, queueName);
        return;
      }
      winston.debug(
        "Queue '%s' length is: %d",
        queueName,
        result.approximateMessageCount
      );
      appInsightsClient.trackMetric({
        name: `queue.length.${queueName}`,
        value: result.approximateMessageCount || 0
      });
    })
  );
}
