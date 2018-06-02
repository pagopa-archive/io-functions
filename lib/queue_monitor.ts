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

export async function index(context: IContext): Promise<void> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  [
    EMAIL_NOTIFICATION_QUEUE_NAME,
    WEBHOOK_NOTIFICATION_QUEUE_NAME,
    MESSAGE_QUEUE_NAME
  ].map(queueName =>
    queueService.getQueueMetadata(queueName, (error, result) => {
      if (error) {
        winston.error("Error in queue monitor: %s (%s)", error, queueName);
        return;
      }
      winston.debug(
        "Queue %s count: %d",
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
