/**
 * Implements utility functions for Azure Storage queues
 */
import * as winston from "winston";

import { IContext } from "azure-functions-types";
import { QueueService } from "azure-storage";

// Array of intervals, in seconds, to delay message processing
// The array *must* contain = (maxDequeueCount - 1) items
// Any value must be less than 7 days (< 604800 seconds)
const RETRIES: ReadonlyArray<number> = [
  10,
  60,
  600,
  3600,
  21600,
  86400,
  172800,
  345600
];

// if (MAX_RETRIES < maxDequeueCount) - 1 there will be other extraneous
//    #(maxDequeueCount - MAX_RETRIES) retries with the default visibilityTimeout
//    before putting the message into the poison queue
// if (MAX_RETRIES > maxDequeueCount - 1) the system will retry even after maxDequeueCount
//    is reached and duplicate messages will be put into the poison queue
const MAX_RETRIES = RETRIES.length;

export function queueMessageToString(context: IContext): string {
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
export function retry(
  queueService: QueueService,
  queueName: string,
  context: IContext
): void {
  const queueMessage = context.bindingData;
  winston.debug(`Retry to handle message ${queueMessageToString(context)}`);

  // TODO: check time to live
  const retries = queueMessage.dequeueCount;

  if (retries <= MAX_RETRIES) {
    // timeout in seconds before the message will be processed again
    const visibilityTimeout = RETRIES[retries - 1];

    const retryMsg = `Retrying with timeout|retry=${retries}|timeout=${visibilityTimeout}|queueMessageId=${
      queueMessage.id
    }`;

    // update message visibilityTimeout
    queueService.updateMessage(
      queueName,
      queueMessage.id,
      queueMessage.popReceipt,
      visibilityTimeout,
      err => {
        context.done(err || retryMsg);
      }
    );
  } else {
    if (retries > MAX_RETRIES) {
      winston.error(
        `Maximum number of retries reached|retries=${retries}|${
          queueMessage.id
        }`
      );
    }
    // maximum number of retries reached (or time to live expired)
    // send the message to poison queue
    context.done(
      `Moving queueMessage=${queueMessage.id} to ${queueName}-poison`
    );
  }
}
