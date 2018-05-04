/**
 * Implements utility functions for Azure Storage queues
 */
import * as winston from "winston";

import { QueueService } from "azure-storage";

import { Either } from "fp-ts/lib/Either";
import { Option, some } from "fp-ts/lib/Option";
import {
  isTransient,
  RuntimeError,
  toRuntimeError,
  TransientError
} from "./errors";

export interface IQueueMessage extends QueueService.QueueMessageResult {
  readonly id: string;
  readonly nextVisibleTime: string;
  readonly popReceipt: string;
  readonly queueTrigger: string;
}

// Any delay must be less than 7 days (< 604800 seconds).
// See the maximum value of the TimeToLiveSeconds field
// in the OpenApi specs (api/definitions.yaml)
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

/* istanbul ignore next */
export function queueMessageToString(queueMessage: IQueueMessage): string {
  return [
    "queueTrigger = ",
    queueMessage.queueTrigger,
    "; expirationTime = ",
    queueMessage.expirationTime,
    "; insertionTime = ",
    queueMessage.insertionTime,
    "; nextVisibleTime = ",
    queueMessage.nextVisibleTime,
    "; id = ",
    queueMessage.id,
    "; popReceipt = ",
    queueMessage.popReceipt,
    "; dequeueCount = ",
    queueMessage.dequeueCount
  ].join("");
}

/**
 * Update message visibilityTimeout with an incremental delay.
 *
 * You MUST call context.done(retryMsg) or throw an exception in the caller
 * to schedule a retry (the re-processing of a message in the queue).
 *
 * Useful in case of transient errors. The message is enqueued with
 * a newly computed visibilityTimeout (proportional to dequeueCount)
 *
 * @param queueService  The Azure storage queue service
 * @param queueName     The Azure storage queue name
 * @param context       The Functions context with bindings
 *
 * @return              False if message is expired.
 */
export function updateMessageVisibilityTimeout<T extends IQueueMessage>(
  queueService: QueueService,
  queueName: string,
  queueMessage: T
): Promise<boolean> {
  return new Promise(resolve => {
    winston.debug(
      `Retry to handle message ${queueMessageToString(queueMessage)}`
    );

    if (!queueMessage.dequeueCount) {
      throw new Error(
        "Fatal ! System error: message enqueued without dequeueCount"
      );
    }

    // dequeueCount starts with one (not zero)
    const numberOfRetries = queueMessage.dequeueCount;

    return getDelaySecForRetries(numberOfRetries)
      .map(visibilityTimeoutSec => {
        // update message visibilityTimeout
        queueService.updateMessage(
          queueName,
          queueMessage.id,
          queueMessage.popReceipt,
          visibilityTimeoutSec,
          err => {
            if (err) {
              winston.error(
                `updateMessageVisibilityTimeout|Error|${err.message}`
              );
            }
            winston.info(
              `Updated visibilityTimeout|retry=${numberOfRetries}|timeout=${visibilityTimeoutSec}|queueMessageId=${
                queueMessage.id
              }`
            );
            // try to schedule a retry even in case updateMessage fails
            resolve(true);
          }
        );
      })
      .getOrElseL(() => {
        winston.info(
          `Maximum number of retries reached|retries=${numberOfRetries}|${
            queueMessage.id
          }`
        );
        resolve(false);
      });
  });
}

/**
 * Call this method in the catch handler of a queue handler to:
 *
 * - execute onTransientError() in case of Transient Error
 * - execute onPermanentError() in case of Permanent Error
 * - trigger a retry in case of TransientError
 *   and retriesNumber < maxRetriesNumber
 */
export async function handleQueueProcessingFailure(
  queueService: QueueService,
  queueMessage: IQueueMessage,
  queueName: string,
  onTransientError: () => Promise<Either<RuntimeError, {}>>,
  onPermanentError: () => Promise<Either<RuntimeError, {}>>,
  error: Error | RuntimeError
): Promise<void> {
  const runtimeError = toRuntimeError(error);
  if (isTransient(runtimeError)) {
    winston.warn(`Transient error|${queueName}|${runtimeError.message}`);
    const shouldTriggerARetry = await updateMessageVisibilityTimeout(
      queueService,
      queueName,
      queueMessage
    );
    // execute the callback for transient errors
    await onTransientError()
      .then(errorOrResult =>
        errorOrResult.mapLeft(err =>
          winston.warn(
            `Transient error (onTransientError)|${queueName}|${err.message}`
          )
        )
      )
      .catch(winston.error);
    if (shouldTriggerARetry) {
      // throws to trigger a retry in the caller handler
      throw TransientError(`Retry|${queueName}|${runtimeError.message}`);
    } else {
      winston.error(
        `Maximum number of retries reached, stop processing|${queueName}|${
          runtimeError.message
        }`
      );
    }
  } else {
    winston.error(`Permanent error|${queueName}|${runtimeError.message}`);
    // execute the callback for permanent errors
    await onPermanentError().then(
      errorOrResult =>
        errorOrResult.fold(
          // try to trigger a retry in case any error
          // occurs during the execution of the callback
          callbackError =>
            handleQueueProcessingFailure(
              queueService,
              queueMessage,
              queueName,
              onTransientError,
              onPermanentError,
              TransientError(callbackError.message)
            ),
          // exits (stop processing) in case no error
          // occurs during the execution of the callback
          async () => void 0
        )
      // do not catch here, let it throw
    );
  }
}
