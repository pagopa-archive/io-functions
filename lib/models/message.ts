import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option, option } from "ts-option";
import { Either } from "../utils/either";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";
import { LimitedFields } from "../utils/types";

/**
 * Base interface for Message objects
 */
export interface IMessage {
  readonly fiscalCode: FiscalCode;
  readonly bodyShort: string;
  readonly senderOrganizationId: string;
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

/**
 * Converts a Message to an IPublicExtendedMessage
 */
export function asPublicExtendedMessage<T extends IMessage>(message: T): IPublicExtendedMessage {
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

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedMessage {
  return ({
    ...result,
    kind: "IRetrievedMessage",
  } as IRetrievedMessage);
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<INewMessage, IRetrievedMessage> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Message model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl) {
    super();
    // tslint:disable-next-line:no-object-mutation
    this.toRetrieved = toRetrieved;
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUrl = collectionUrl;
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
    const errorOrMessage = await this.find(messageId, fiscalCode);
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
