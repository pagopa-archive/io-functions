import * as t from "io-ts";

import { pick, tag } from "../utils/types";

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../utils/documentdb_model_versioned";

import { Either } from "fp-ts/lib/Either";

import {
  MessageStatusValue,
  MessageStatusValueEnum
} from "../api/definitions/MessageStatusValue";
import { Timestamp } from "../api/definitions/Timestamp";

import { Option } from "fp-ts/lib/Option";
import { nonEmptyStringToModelId } from "../utils/conversions";
import { RuntimeError, TransientError } from "../utils/errors";
import { NonNegativeNumber } from "../utils/numbers";
import { NonEmptyString } from "../utils/strings";

export const MESSAGE_STATUS_COLLECTION_NAME = "message-status";
export const MESSAGE_STATUS_MODEL_ID_FIELD = "messageId";
export const MESSAGE_STATUS_MODEL_PK_FIELD = "messageId";

// We cannot intersect with MessageStatus
// as it is a *strict* interface
export const MessageStatus = t.interface({
  messageId: NonEmptyString,
  status: MessageStatusValue,
  updatedAt: Timestamp
});

export type MessageStatus = t.TypeOf<typeof MessageStatus>;

/**
 * Interface for new MessageStatus objects
 */

interface INewMessageStatusTag {
  readonly kind: "INewMessageStatus";
}

export const NewMessageStatus = tag<INewMessageStatusTag>()(
  t.intersection([MessageStatus, DocumentDbUtils.NewDocument, VersionedModel])
);

export type NewMessageStatus = t.TypeOf<typeof NewMessageStatus>;

/**
 * Interface for retrieved MessageStatus objects
 *
 * Existing MessageStatus records have a version number.
 */
interface IRetrievedMessageStatusTag {
  readonly kind: "IRetrievedMessageStatus";
}

export const RetrievedMessageStatus = tag<IRetrievedMessageStatusTag>()(
  t.intersection([
    MessageStatus,
    DocumentDbUtils.RetrievedDocument,
    VersionedModel
  ])
);

export type RetrievedMessageStatus = t.TypeOf<typeof RetrievedMessageStatus>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedMessageStatus {
  return RetrievedMessageStatus.decode(result).getOrElseL(_ => {
    throw new Error("Fatal, result is not a valid RetrievedMessageStatus");
  });
}

function getModelId(o: MessageStatus): ModelId {
  return nonEmptyStringToModelId(o.messageId);
}

function updateModelId(
  o: MessageStatus,
  id: NonEmptyString,
  version: NonNegativeNumber
): NewMessageStatus {
  return {
    ...o,
    id,
    kind: "INewMessageStatus",
    version
  };
}

function toBaseType(o: RetrievedMessageStatus): MessageStatus {
  return pick(["messageId", "status", "updatedAt"], o);
}

export type MessageStatusUpdater = ((
  status: MessageStatusValueEnum
) => Promise<Either<RuntimeError, RetrievedMessageStatus>>);

/**
 * Convenience method that returns a function
 * to update the Message status.
 */
export const getMessageStatusUpdater = (
  messageStatusModel: MessageStatusModel,
  messageId: NonEmptyString
): MessageStatusUpdater => {
  return async status => {
    return await messageStatusModel
      .upsert(
        {
          messageId,
          status,
          updatedAt: new Date()
        },
        MESSAGE_STATUS_MODEL_ID_FIELD,
        messageId,
        MESSAGE_STATUS_MODEL_PK_FIELD,
        messageId
      )
      .then(errorOrResult =>
        errorOrResult.mapLeft(err => TransientError(err.body))
      );
  };
};

/**
 * A model for handling MessageStatus
 */
export class MessageStatusModel extends DocumentDbModelVersioned<
  MessageStatus,
  NewMessageStatus,
  RetrievedMessageStatus
> {
  /**
   * Creates a new MessageStatus model
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

  public findOneByMessageId(
    messageId: NonEmptyString
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedMessageStatus>>> {
    return super.findLastVersionByModelId(
      MESSAGE_STATUS_MODEL_ID_FIELD,
      messageId
    );
  }
}
