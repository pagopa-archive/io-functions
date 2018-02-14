/**
 * Implements utility functions for Azure Storage queues
 */
import * as winston from "winston";

import { IContext } from "azure-functions-types";
import { QueueService } from "azure-storage";

import { Option, some } from "fp-ts/lib/Option";

// Any delay must be less than 7 days (< 604800 seconds)
const MAX_BACKOFF_MS = 7 * 24 * 3600 * 1000;
const MIN_BACKOFF_MS = 285;

// MAX_RETRIES *must* equal (maxDequeueCount - 1)
// if (MAX_RETRIES < maxDequeueCount) - 1 there will be other extraneous
//    #(maxDequeueCount - MAX_RETRIES) retries with the default visibilityTimeout
//    before putting the message into the poison queue
// if (MAX_RETRIES > maxDequeueCount - 1) the system will retry even after maxDequeueCount
//    is reached and duplicate messages will be put into the poison queue
export const MAX_RETRIES = Math.floor(
  Math.log2(MAX_BACKOFF_MS / MIN_BACKOFF_MS)
);

/**
 * Compute the timeout in seconds before the message will be processed again.
 * returns none in case the maximum number of retries is reached
 */
export const getDelaySecForRetries = (
  retries: number,
  maxRetries = MAX_RETRIES,
  minBackoff = MIN_BACKOFF_MS
): Option<number> =>
  some(retries)
    .filter(nr => nr <= maxRetries)
    .map(nr => Math.ceil(minBackoff * Math.pow(2, nr) / 1000));

export function queueMessageToString(context: IContext): string {
  /* istanbul ignore next */
  return [
    "bindings = ",
    JSON.stringify(context.bindings),
    "; queueTrigger = ",
    context.bindingData.queueTrigger,
    "; expirationTime = ",
    context.bindingData.expirationTime,
    "; insertionTime = ",
    context.bindingData.insertionTime,
    "; nextVisibleTime = ",
    context.bindingData.nextVisibleTime,
    "; id = ",
    context.bindingData.id,
    "; popReceipt = ",
    context.bindingData.popReceipt,
    "; dequeueCount = ",
    context.bindingData.dequeueCount
  ].join("");
}

/**
 * Schedule the re-processing of a message in the queue
 * after an incremental delay (visibilityTimeout).
 *
 * Useful in case of transient errors. The message is enqueued with
 * a newly computed visibilityTimeout (proportional to dequeueCount)
 *
 * @param queueService  The Azure storage queue service
 * @param queueName     The Azure storage queue name
 * @param context       The Functions context with bindings
 */
export function retryMessageEnqueue(
  queueService: QueueService,
  queueName: string,
  context: IContext
): void {
  const queueMessage = context.bindingData;

  winston.debug(`Retry to handle message ${queueMessageToString(context)}`);

  // dequeueCount starts with one (not zero)
  const numberOfRetries = queueMessage.dequeueCount;

  getDelaySecForRetries(numberOfRetries)
    .map(visibilityTimeoutSec => {
      // update message visibilityTimeout
      queueService.updateMessage(
        queueName,
        queueMessage.id,
        queueMessage.popReceipt,
        visibilityTimeoutSec,
        err => {
          context.done(
            err ||
              `Retrying with timeout|retry=${numberOfRetries}|timeout=${visibilityTimeoutSec}|queueMessageId=${
                queueMessage.id
              }`
          );
        }
      );
    })
    .getOrElseL(() => {
      winston.info(
        `Maximum number of retries reached|retries=${numberOfRetries}|${
          queueMessage.id
        }`
      );
      context.done(
        `Moving queueMessage=${queueMessage.id} to ${queueName}-poison`
      );
    });
}
