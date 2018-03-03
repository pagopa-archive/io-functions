import * as t from "io-ts";

import { ReadableReporter } from "./../utils/validation_reporters";

import * as DocumentDb from "documentdb";

import { pick, tag } from "../utils/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone, none, Option, some } from "fp-ts/lib/Option";
import { NonEmptyString } from "../utils/strings";

import { MessageContent } from "../api/definitions/MessageContent";

import { FiscalCode } from "../api/definitions/FiscalCode";

import { BlobService } from "azure-storage";
import { Timestamp } from "../api/definitions/Timestamp";
import { TimeToLive } from "../api/definitions/TimeToLive";
import { getBlobAsText, upsertBlobFromObject } from "../utils/azure_storage";
import { iteratorToArray } from "../utils/documentdb";

const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

const MessageBase = t.interface(
  {
    // the fiscal code of the recipient
    fiscalCode: FiscalCode,

    // the identifier of the service of the sender
    senderServiceId: t.string,

    // the userId of the sender (this is opaque and depends on the API gateway)
    senderUserId: NonEmptyString,

    // time to live in seconds
    timeToLive: TimeToLive,

    // timestamp: the message was accepted by the system
    createdAt: Timestamp
  },
  "MessageBase"
);

/**
 * The attributes common to all types of Message
 */
type MessageBase = t.TypeOf<typeof MessageBase>;

/**
 * A Message without content.
 *
 * A Message gets stored without content if the recipient didn't opt-in
 * to have the content of the messages permanently stored in his inbox.
 */
export type MessageWithoutContent = MessageBase;

export const MessageWithoutContent = MessageBase;

/**
 * A Message with content
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export const MessageWithContent = t.intersection([
  t.interface({
    content: MessageContent
  }),
  MessageBase
]);

export type MessageWithContent = t.TypeOf<typeof MessageWithContent>;

/**
 * A Message can be with our without content
 */
export const Message = t.union([MessageWithoutContent, MessageWithContent]);

export type Message = t.TypeOf<typeof Message>;

/**
 * A (yet to be saved) Message with content
 */

interface INewMessageWithContentTag {
  readonly kind: "INewMessageWithContent";
}

export const NewMessageWithContent = tag<INewMessageWithContentTag>()(
  t.intersection([MessageWithContent, DocumentDbUtils.NewDocument])
);

export type NewMessageWithContent = t.TypeOf<typeof NewMessageWithContent>;

/**
 * A (yet to be saved) Message without content
 */
interface INewMessageWithoutContentTag {
  readonly kind: "INewMessageWithoutContent";
}

export const NewMessageWithoutContent = tag<INewMessageWithoutContentTag>()(
  t.intersection([MessageWithoutContent, DocumentDbUtils.NewDocument])
);

export type NewMessageWithoutContent = t.TypeOf<
  typeof NewMessageWithoutContent
>;

/**
 * A (yet to be saved) Message
 */
export const NewMessage = t.union([
  NewMessageWithContent,
  NewMessageWithoutContent
]);

export type NewMessage = t.TypeOf<typeof NewMessage>;

/**
 * A (previously saved) retrieved Message with content
 */

interface IRetrievedMessageWithContentTag {
  readonly kind: "IRetrievedMessageWithContent";
}

export const RetrievedMessageWithContent = tag<
  IRetrievedMessageWithContentTag
>()(t.intersection([MessageWithContent, DocumentDbUtils.RetrievedDocument]));

export type RetrievedMessageWithContent = t.TypeOf<
  typeof RetrievedMessageWithContent
>;

/**
 * A (previously saved) retrieved Message without content
 */

interface IRetrievedMessageWithoutContentTag {
  readonly kind: "IRetrievedMessageWithoutContent";
}

export const RetrievedMessageWithoutContent = tag<
  IRetrievedMessageWithoutContentTag
>()(t.intersection([MessageWithoutContent, DocumentDbUtils.RetrievedDocument]));

export type RetrievedMessageWithoutContent = t.TypeOf<
  typeof RetrievedMessageWithoutContent
>;

export const NotExpiredMessage = t.refinement(
  MessageBase,
  message => Date.now() - message.createdAt.getTime() <= message.timeToLive,
  "ValidNewMessageWithContent"
);

export type NotExpiredMessage = t.TypeOf<typeof NotExpiredMessage>;

/**
 * A (previously saved) retrieved Message
 */

export const RetrievedMessage = t.union([
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
]);

export type RetrievedMessage = t.TypeOf<typeof RetrievedMessage>;

function toBaseType(o: RetrievedMessage): Message {
  const props: ReadonlyArray<keyof Message> = [
    "fiscalCode",
    "senderServiceId",
    "senderUserId",
    "timeToLive",
    "createdAt"
  ];
  return RetrievedMessageWithContent.is(o)
    ? pick(["content", ...props], o)
    : pick(props, o);
}

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedMessage {
  return RetrievedMessage.decode(result).getOrElseL(errs => {
    throw new Error(
      "Retrieved result wasn't a RetrievedMessage" +
        ReadableReporter.report(left(errs)).join("\n")
    );
  });
}

function blobIdFromMessageId(messageId: string): string {
  return `${messageId}${MESSAGE_BLOB_STORAGE_SUFFIX}`;
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<
  Message,
  NewMessage,
  RetrievedMessage
> {
  /**
   * Creates a new Message model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   * @param containerName the name of the blob storage container to store message content in
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri,
    protected readonly containerName: NonEmptyString
  ) {
    super(dbClient, collectionUrl, toBaseType, toRetrieved);
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public async findMessageForRecipient(
    fiscalCode: FiscalCode,
    messageId: string
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedMessage>>> {
    const errorOrMaybeMessage = await this.find(messageId, fiscalCode);

    return errorOrMaybeMessage.map(maybeMessage =>
      maybeMessage.filter(m => m.fiscalCode === fiscalCode)
    );
  }

  /**
   * Returns the messages for the provided fiscal code
   *
   * @param fiscalCode The fiscal code of the recipient
   */
  public findMessages(
    fiscalCode: FiscalCode
  ): DocumentDbUtils.IResultIterator<RetrievedMessageWithContent> {
    return DocumentDbUtils.queryDocuments(this.dbClient, this.collectionUri, {
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: "SELECT * FROM messages m WHERE (m.fiscalCode = @fiscalCode)"
    });
  }

  /**
   * Attach a media (a stored text blob) to the existing message document.
   *
   * @param blobService     the azure.BlobService used to store the media
   * @param messageId       the message document id
   * @param partitionKey    the message document partitionKey
   * @param messageContent  the message document content
   */
  public async attachStoredContent(
    blobService: BlobService,
    messageId: string,
    partitionKey: string,
    messageContent: MessageContent
  ): Promise<
    Either<Error | DocumentDb.QueryError, Option<DocumentDb.AttachmentMeta>>
  > {
    // this is the attachment id __and__ the media filename
    const blobId = blobIdFromMessageId(messageId);

    // store media (attachment) with message content in blob storage
    const errorOrMessageContent = await upsertBlobFromObject<MessageContent>(
      blobService,
      this.containerName,
      blobId,
      messageContent
    );

    if (isLeft(errorOrMessageContent)) {
      return left(errorOrMessageContent.value);
    }

    const mediaUrl = blobService.getUrl(this.containerName, blobId);

    // attach the created media to the message identified by messageId and partitionKey
    const errorOrAttachmentMeta = await this.attach(messageId, partitionKey, {
      contentType: "application/json",
      id: blobId,
      media: mediaUrl
    });

    if (isLeft(errorOrAttachmentMeta)) {
      return left(errorOrAttachmentMeta.value);
    }

    return right(errorOrAttachmentMeta.value);
  }

  /**
   * Get stored MessageContent (if any) from blob service.
   */
  public async getStoredContent(
    blobService: BlobService,
    messageId: string,
    fiscalCode: FiscalCode
  ): Promise<Either<Error, Option<MessageContent>>> {
    // get link to attached blob(s)
    const media = await iteratorToArray(
      await this.getAttachments(messageId, {
        partitionKey: fiscalCode
      })
    );

    // no blob(s) attached to the message
    if (!media || !media[0]) {
      return right<Error, Option<MessageContent>>(none);
    }

    const blobId = blobIdFromMessageId(messageId);

    // retrieve blob content and deserialize
    const maybeContentAsTextOrError = await getBlobAsText(
      blobService,
      this.containerName,
      blobId
    );

    if (isLeft(maybeContentAsTextOrError)) {
      return left<Error, Option<MessageContent>>(
        maybeContentAsTextOrError.value
      );
    }

    // media exists but the content is empty
    const maybeContentAsText = maybeContentAsTextOrError.value;
    if (isNone(maybeContentAsText)) {
      return left<Error, Option<MessageContent>>(
        new Error("Cannot get stored message content from attachment")
      );
    }

    const contentAsText = maybeContentAsText.value;

    // deserialize text into JSON
    const contentOrError = MessageContent.decode(JSON.parse(contentAsText));

    if (isLeft(contentOrError)) {
      const errors: string = ReadableReporter.report(contentOrError).join(", ");
      return left<Error, Option<MessageContent>>(
        new Error(`Cannot deserialize stored message content: ${errors}`)
      );
    }

    const content = contentOrError.value;
    return right<Error, Option<MessageContent>>(some(content));
  }
}
