import * as t from "io-ts";

import * as DocumentDb from "documentdb";

import { tag } from "../utils/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { NonEmptyString } from "../utils/strings";

import { MessageContent } from "../api/definitions/MessageContent";

import { FiscalCode } from "../api/definitions/FiscalCode";

import { BlobService } from "azure-storage";
import { upsertBlobFromObject } from "../utils/azure_storage";

const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

const MessageBase = t.interface({
  // the fiscal code of the recipient
  fiscalCode: FiscalCode,

  // the identifier of the service of the sender
  senderServiceId: t.string,

  // the userId of the sender (this is opaque and depends on the API gateway)
  senderUserId: NonEmptyString
});

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

/**
 * A (previously saved) retrieved Message
 */

export const RetrievedMessage = t.union([
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
]);

export type RetrievedMessage = t.TypeOf<typeof RetrievedMessage>;

function toBaseType(o: RetrievedMessage): Message {
  if (RetrievedMessageWithContent.is(o)) {
    return {
      content: o.content,
      fiscalCode: o.fiscalCode,
      senderServiceId: o.senderServiceId,
      senderUserId: o.senderUserId
    };
  } else {
    return {
      fiscalCode: o.fiscalCode,
      senderServiceId: o.senderServiceId,
      senderUserId: o.senderUserId
    };
  }
}

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedMessage {
  if (RetrievedMessageWithContent.is(result)) {
    return result;
  }
  if (RetrievedMessageWithoutContent.is(result)) {
    return result;
  }
  throw new Error(
    "retrieved result was neither a RetrievedMessageWithContent nor a RetrievedMessageWithoutContent"
  );
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<
  Message,
  NewMessage,
  RetrievedMessage
> {
  // tslint:disable-next-line:readonly-keyword
  protected dbClient: DocumentDb.DocumentClient;
  // tslint:disable-next-line:readonly-keyword
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;
  // tslint:disable-next-line:readonly-keyword
  protected containerName: NonEmptyString;

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
    containerName: NonEmptyString
  ) {
    super();
    // tslint:disable-next-line:no-object-mutation
    this.toBaseType = toBaseType;
    // tslint:disable-next-line:no-object-mutation
    this.toRetrieved = toRetrieved;
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUri = collectionUrl;
    // tslint:disable-next-line:no-object-mutation
    this.containerName = containerName;
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
    const blobId = `${messageId}${MESSAGE_BLOB_STORAGE_SUFFIX}`;

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
}
