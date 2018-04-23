import * as t from "io-ts";

import { pick, tag } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../utils/documentdb_model_versioned";

import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  NotificationChannel,
  NotificationChannelEnum
} from "../api/definitions/NotificationChannel";
import {
  NotificationChannelStatusValue,
  NotificationChannelStatusValueEnum
} from "../api/definitions/NotificationChannelStatusValue";
import { Timestamp } from "../api/definitions/Timestamp";
import { notificationStatusIdToModelId } from "../utils/conversions";
import { RuntimeError, TransientError } from "../utils/errors";

export const NOTIFICATION_STATUS_COLLECTION_NAME = "notification-status";
export const NOTIFICATION_STATUS_MODEL_ID_FIELD = "statusId";
export const NOTIFICATION_STATUS_MODEL_PK_FIELD = "notificationId";

interface INotificationStatusIdTag {
  readonly kind: "INotificationStatusIdTag";
}

export const NotificationStatusId = tag<INotificationStatusIdTag>()(t.string);
export type NotificationStatusId = t.TypeOf<typeof NotificationStatusId>;

// We cannot intersect with NotificationChannelStatus
// as it is a *strict* interface
export const NotificationStatus = t.interface({
  channel: NotificationChannel,
  messageId: NonEmptyString,
  notificationId: NonEmptyString,
  status: NotificationChannelStatusValue,
  // As we have one NotificationStatus for each channel
  // of a Notification => statusId = notificationId + channelName
  statusId: NotificationStatusId,
  updatedAt: Timestamp
});

export type NotificationStatus = t.TypeOf<typeof NotificationStatus>;

/**
 * Interface for new NotificationStatus objects
 */

interface INewNotificationStatusTag {
  readonly kind: "INewNotificationStatus";
}

export const NewNotificationStatus = tag<INewNotificationStatusTag>()(
  t.intersection([
    NotificationStatus,
    DocumentDbUtils.NewDocument,
    VersionedModel
  ])
);

export type NewNotificationStatus = t.TypeOf<typeof NewNotificationStatus>;

/**
 * Interface for retrieved NotificationStatus objects
 *
 * Existing NotificationStatus records have a version number.
 */
interface IRetrievedNotificationStatusTag {
  readonly kind: "IRetrievedNotificationStatus";
}

export const RetrievedNotificationStatus = tag<
  IRetrievedNotificationStatusTag
>()(
  t.intersection([
    NotificationStatus,
    DocumentDbUtils.RetrievedDocument,
    VersionedModel
  ])
);

export type RetrievedNotificationStatus = t.TypeOf<
  typeof RetrievedNotificationStatus
>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedNotificationStatus {
  return RetrievedNotificationStatus.decode(result).getOrElseL(_ => {
    throw new Error("Fatal, result is not a valid RetrievedNotificationStatus");
  });
}

export function makeStatusId(
  notificationId: NonEmptyString,
  channel: NotificationChannel
): NotificationStatusId {
  return NotificationStatusId.decode(`${notificationId}:${channel}`).getOrElseL(
    () => {
      throw new Error("Invalid Notification Status id");
    }
  );
}

function getModelId(o: NotificationStatus): ModelId {
  return notificationStatusIdToModelId(
    makeStatusId(o.notificationId, o.channel)
  );
}

function updateModelId(
  o: NotificationStatus,
  id: NonEmptyString,
  version: NonNegativeNumber
): NewNotificationStatus {
  return {
    ...o,
    id,
    kind: "INewNotificationStatus",
    version
  };
}

function toBaseType(o: RetrievedNotificationStatus): NotificationStatus {
  return pick(
    [
      "channel",
      "messageId",
      "notificationId",
      "status",
      "statusId",
      "updatedAt"
    ],
    o
  );
}

export type NotificationStatusUpdater = ((
  status: NotificationChannelStatusValueEnum
) => Promise<Either<RuntimeError, RetrievedNotificationStatus>>);

/**
 * Convenience method that returns a function to update the notification status
 * for the message / notification / channel passed as inputs.
 */
export const getNotificationStatusUpdater = (
  notificationStatusModel: NotificationStatusModel,
  channel: NotificationChannelEnum,
  messageId: NonEmptyString,
  notificationId: NonEmptyString
): NotificationStatusUpdater => {
  return async status => {
    const statusId = makeStatusId(notificationId, channel);
    return await notificationStatusModel
      .upsert(
        {
          channel,
          messageId,
          notificationId,
          status,
          statusId,
          updatedAt: new Date()
        },
        NOTIFICATION_STATUS_MODEL_ID_FIELD,
        statusId,
        NOTIFICATION_STATUS_MODEL_PK_FIELD,
        notificationId
      )
      .then(errorOrResult =>
        errorOrResult.mapLeft(err => TransientError(err.body))
      );
  };
};

/**
 * A model for handling NotificationStatus
 */
export class NotificationStatusModel extends DocumentDbModelVersioned<
  NotificationStatus,
  NewNotificationStatus,
  RetrievedNotificationStatus
> {
  /**
   * Creates a new NotificationStatus model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(
      dbClient,
      collectionUrl,
      toBaseType,
      toRetrieved,
      getModelId,
      updateModelId
    );
  }

  /**
   * Find the latest status for this notification channel.
   *
   * There is one notification for each channel and
   * one versioned status model for each notification.
   *
   * @param notificationId id of the notification
   * @param channel the notification channel (ie. email)
   */
  public findOneNotificationStatusByNotificationChannel(
    notificationId: NonEmptyString,
    channel: NotificationChannel
  ): Promise<
    Either<DocumentDb.QueryError, Option<RetrievedNotificationStatus>>
  > {
    const statusId = makeStatusId(notificationId, channel);
    return this.findOneNotificationStatusById(statusId, notificationId);
  }

  /**
   * Find the latest status for this notification.
   *
   * There is one notification for each channel and
   * one versioned status model for each notification.
   *
   * We need to pass both statusId and notificationId
   * to avoid multi-partition queries.
   *
   * @param statusId of the NotificationStatus object
   * @param notificationId id of the NotificationStatus object
   */
  private findOneNotificationStatusById(
    statusId: NotificationStatusId,
    notificationId: NonEmptyString
  ): Promise<
    Either<DocumentDb.QueryError, Option<RetrievedNotificationStatus>>
  > {
    return super.findLastVersionByModelId(
      NOTIFICATION_STATUS_MODEL_ID_FIELD,
      statusId,
      NOTIFICATION_STATUS_MODEL_PK_FIELD,
      notificationId
    );
  }
}
