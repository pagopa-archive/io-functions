import * as winston from "winston";

import { configureAzureContextTransport } from "../lib/utils/logging";

import { getRequiredStringEnv } from "../lib/utils/env";

import { IContext } from "azure-functions-types";
import { createQueueService } from "azure-storage";
import { retry } from "../lib/utils/azure_queues";

const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

export function index(context: IContext): void {
  configureAzureContextTransport(context, winston, "debug");
  // winston.debug(JSON.stringify(context, undefined, 2));
  const queueService = createQueueService(queueConnectionString);
  retry(queueService, "testmessages", context);
}
