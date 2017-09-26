import * as DocumentDb from "documentdb";
import is from "ts-is";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option } from "ts-option";
import { Either, left, right } from "../utils/either";
import { isNonEmptyString, NonEmptyString } from "../utils/strings";

import { BodyShort, isBodyShort } from "../api/definitions/BodyShort";
import { FiscalCode, isFiscalCode } from "../api/definitions/FiscalCode";

import {
  BlobService,
  getBlobUrl,
  upsertBlobFromText
} from "../utils/azure_storage";

const MESSAGE_BLOB_STORAGE_CONTAINER_NAME = "message-content";
const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

/**
 * The content of a Message
 */
export interface IMessageContent {
  readonly bodyShort: BodyShort;
}

/**
 * Type guard for IMessageContent
 */
export const isIMessageContent = is<IMessageContent>(
  arg => arg && isBodyShort(arg.bodyShort)
);

/**
 * The attributes common to all types of Message
 */
interface IMessageBase {
  // the fiscal code of the recipient
  readonly fiscalCode: FiscalCode;

  // the identifier of the Organization of the sender
  readonly senderOrganizationId: string;

  // the userId of the sender (this is opaque and depends on the API gateway)
  readonly senderUserId: NonEmptyString;
}

/**
 * A Message without content.
 *
 * A Message gets stored without content if the recipient didn't opt-in
 * to have the content of the messages permanently stored in his inbox.
 */
export type IMessageWithoutContent = IMessageBase;

/**
 * A Message with content
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export interface IMessageWithContent extends IMessageBase {
  readonly content: IMessageContent;
}

/**
 * A Message can be with our without content
 */
export type IMessage = IMessageWithoutContent | IMessageWithContent;

/**
 * Type guard for IMessageBase
 */
const isIMessageBase = is<IMessageBase>(
  arg =>
    arg &&
    isFiscalCode(arg.fiscalCode) &&
    isNonEmptyString(arg.senderOrganizationId) &&
    isNonEmptyString(arg.senderUserId)
);

/**
 * Type guard for IMessageWithContent
 */
export const isIMessageWithContent = is<IMessageWithContent>(
  arg => arg && isIMessageContent(arg.content) && isIMessageBase(arg)
);

/**
 * Type guard for IMessageWithoutContent
 */
export const isIMessageWithoutContent = is<IMessageWithoutContent>(
  arg =>
    arg &&
    (arg.content === undefined || arg.content === null) &&
    isIMessageBase(arg)
);

/**
 * Type guard for IMessage
 */
export const isIMessage = is<IMessage>(
  arg => isIMessageWithContent(arg) || isIMessageWithoutContent(arg)
);

/**
 * A (yet to be saved) Message with content
 */
export interface INewMessageWithContent
  extends IMessageWithContent,
    DocumentDb.NewDocument {
  readonly kind: "INewMessageWithContent";
  readonly id: NonEmptyString;
}

/**
 * A (yet to be saved) Message without content
 */
export interface INewMessageWithoutContent
  extends IMessageWithoutContent,
    DocumentDb.NewDocument {
  readonly kind: "INewMessageWithoutContent";
  readonly id: NonEmptyString;
}

/**
 * A (yet to be saved) Message
 */
export type INewMessage = INewMessageWithContent | INewMessageWithoutContent;

/**
 * A (previously saved) retrieved Message with content
 */
export interface IRetrievedMessageWithContent
  extends Readonly<IMessageWithContent>,
    Readonly<DocumentDb.RetrievedDocument> {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedMessageWithContent";
}

/**
 * A (previously saved) retrieved Message without content
 */
export interface IRetrievedMessageWithoutContent
  extends Readonly<IMessageWithoutContent>,
    Readonly<DocumentDb.RetrievedDocument> {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedMessageWithoutContent";
}

/**
 * A (previously saved) retrieved Message
 */
export type IRetrievedMessage =
  | IRetrievedMessageWithContent
  | IRetrievedMessageWithoutContent;

/**
 * Type guard for IRetrievedMessageWithContent
 */
export const isIRetrievedMessageWithContent = is<IRetrievedMessageWithContent>(
  arg =>
    isNonEmptyString(arg.id) &&
    typeof arg._self === "string" &&
    (typeof arg._ts === "string" || typeof arg._ts === "number") &&
    isIMessageWithContent(arg)
);

/**
 * Type guard for IRetrievedMessageWithoutContent
 */
export const isIRetrievedMessageWithoutContent = is<
  IRetrievedMessageWithoutContent
>(
  arg =>
    isNonEmptyString(arg.id) &&
    typeof arg._self === "string" &&
    (typeof arg._ts === "string" || typeof arg._ts === "number") &&
    isIMessageWithoutContent(arg)
);

/**
 * Type guard for IRetrievedMessage
 */
export const isIRetrievedMessage = is<IRetrievedMessage>(
  arg =>
    isIRetrievedMessageWithContent(arg) ||
    isIRetrievedMessageWithoutContent(arg)
);

function toBaseType(o: IRetrievedMessage): IMessage {
  if (isIRetrievedMessageWithContent(o)) {
    return {
      content: o.content,
      fiscalCode: o.fiscalCode,
      senderOrganizationId: o.senderOrganizationId,
      senderUserId: o.senderUserId
    };
  } else {
    return {
      fiscalCode: o.fiscalCode,
      senderOrganizationId: o.senderOrganizationId,
      senderUserId: o.senderUserId
    };
  }
}

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): IRetrievedMessageWithContent | IRetrievedMessageWithoutContent {
  if (isIRetrievedMessageWithContent(result)) {
    return {
      ...result,
      kind: "IRetrievedMessageWithContent"
    } as IRetrievedMessageWithContent;
  } else {
    // TODO: we kind of trusting the data storage that this is indeed valid
    // TODO: possibly return an Option in case result fails validation
    return {
      ...result,
      kind: "IRetrievedMessageWithoutContent"
    } as IRetrievedMessageWithoutContent;
  }
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<
  IMessage,
  INewMessage,
  IRetrievedMessage
> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Message model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
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
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedMessage>>> {
    const errorOrMaybeMessage = await this.find(messageId, fiscalCode);

    return errorOrMaybeMessage.mapRight(maybeMessage =>
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
  ): DocumentDbUtils.IResultIterator<IRetrievedMessageWithContent> {
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

  public async attachStoredContent(
    blobService: BlobService,
    messageId: string,
    partitionKey: string,
    message: IMessageWithContent
  ): Promise<Either<Error, Option<DocumentDb.AttachmentMeta>>> {
    // this is the attachment id __and__ the filename
    const blobId = this.getMessageAttachmentName(messageId);

    // store media (attachment) with message content in blob storage
    const errorOrMessageContent = await upsertBlobFromText(
      blobService,
      MESSAGE_BLOB_STORAGE_CONTAINER_NAME,
      blobId,
      JSON.stringify({ id: messageId, ...message })
    );

    if (errorOrMessageContent.isLeft) {
      return left(errorOrMessageContent.left);
    }

    // attach the created media to the message identified by messageId and partitionKey
    const errorOrAttachmentMeta = await this.attach(messageId, partitionKey, {
      contentType: "application/json",
      id: blobId,
      media: getBlobUrl(
        blobService,
        MESSAGE_BLOB_STORAGE_CONTAINER_NAME,
        blobId
      )
    });

    if (errorOrAttachmentMeta.isLeft) {
      return left(
        new Error(
          `Error while attaching stored message: ${errorOrAttachmentMeta.left
            .code} - ${errorOrAttachmentMeta.left.body}`
        )
      );
    }

    return right(errorOrAttachmentMeta.right);
  }

  private getMessageAttachmentName(id: string): string {
    return `${id}${MESSAGE_BLOB_STORAGE_SUFFIX}`;
  }
}
