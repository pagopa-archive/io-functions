import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Option, option } from "ts-option";
import { Either } from "../utils/either";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";
import { LimitedFields } from "../utils/types";
import { ModelId } from "../utils/versioned_model";

/**
 * Base interface for Message objects
 */
export interface IMessage {
  readonly fiscalCode: FiscalCode;
  readonly bodyShort: string;
  readonly senderOrganizationId: ModelId;
}

/**
 * Type guard for IMessage objects
 */
// tslint:disable-next-line:no-any
export function isIMessage(arg: any): arg is IMessage {
  return isFiscalCode(arg.fiscalCode) && (typeof arg.bodyShort === "string");
}

/**
 * Interface for new Message objects
 */
export interface INewMessage extends IMessage, DocumentDb.NewDocument {
  readonly kind: "INewMessage";
}

/**
 * Interface for retrieved Message objects
 */
export interface IRetrievedMessage extends Readonly<IMessage>, Readonly<DocumentDb.RetrievedDocument> {
  readonly kind: "IRetrievedMessage";
}

/**
 * Message objects shared with trusted applications (i.e. client apps).
 */
export interface IPublicExtendedMessage extends
  LimitedFields<IRetrievedMessage, "fiscalCode" | "bodyShort" | "senderOrganizationId"> {
  readonly kind: "IPublicExtendedMessage";
}

export function asPublicExtendedMessage<T extends IRetrievedMessage>(message: T): IPublicExtendedMessage {
  const {
    fiscalCode,
    bodyShort,
    senderOrganizationId,
  } = message;
  return {
    bodyShort,
    fiscalCode,
    kind: "IPublicExtendedMessage",
    senderOrganizationId,
  };
}

/**
 * Type guard for IRetrievedMessage objects
 */
// tslint:disable-next-line:no-any
export function isIRetrievedMessage(arg: any): arg is IRetrievedMessage {
  return (typeof arg.id === "string") &&
    (typeof arg._self === "string") &&
    (typeof arg._ts === "number") &&
    isIMessage(arg);
}

/**
 * A model for handling Messages
 */
export class MessageModel {
  private dbClient: DocumentDb.DocumentClient;
  private collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Message model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl) {
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUrl = collectionUrl;
  }

  /**
   * Creates a new Message
   *
   * @param message The new Message
   */
  public async createMessage(message: INewMessage): Promise<Either<DocumentDb.QueryError, IRetrievedMessage>> {
    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      message,
      message.fiscalCode,
    );
    return maybeCreatedDocument.mapRight((createdDocument) => ({
      ...createdDocument,
      kind: "IRetrievedMessage",
    } as IRetrievedMessage));
  }

  /**
   * Returns the message associated to the provided message ID
   *
   * @param fiscalCode  The fiscal code associated to this message (used as partitionKey)
   * @param messageId   The ID of the message
   */
  public async findMessage(
    fiscalCode: FiscalCode, messageId: string,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedMessage>> {
    const documentUrl = DocumentDbUtils.getDocumentUrl(
      this.collectionUrl,
      messageId,
    );

    const errorOrDocument = await DocumentDbUtils.readDocument<IMessage>(
      this.dbClient,
      documentUrl,
      fiscalCode,
    );

    return errorOrDocument.mapRight((document) => ({
      ...document,
      kind: "IRetrievedMessage",
    } as IRetrievedMessage));
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public async findMessageForRecipient(
    fiscalCode: FiscalCode, messageId: string,
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedMessage>>> {
    const errorOrMessage = await this.findMessage(fiscalCode, messageId);
    return errorOrMessage.mapRight((message) =>
      option(message).filter((m) => m.fiscalCode === fiscalCode),
    );
  }

  /**
   * Returns the messages for the provided fiscal code
   *
   * @param fiscalCode The fiscal code of the recipient
   */
  public findMessages(fiscalCode: FiscalCode): DocumentDbUtils.IResultIterator<IRetrievedMessage> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUrl,
      {
        parameters: [{
          name: "@fiscalCode",
          value: fiscalCode,
        }],
        query: "SELECT * FROM messages m WHERE (m.fiscalCode = @fiscalCode)",
      },
    );
  }

}
