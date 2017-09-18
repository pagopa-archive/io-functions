import * as DocumentDb from "documentdb";
import is from "ts-is";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option } from "ts-option";
import { Either } from "../utils/either";
import { isNonEmptyString, NonEmptyString } from "../utils/strings";

import { BodyShort, isBodyShort } from "../api/definitions/BodyShort";
import { FiscalCode, isFiscalCode } from "../api/definitions/FiscalCode";

import { LimitedFields } from "../utils/types";

/**
 * Base interface for Message objects
 */
export interface IMessage {
  readonly fiscalCode: FiscalCode;
  readonly bodyShort: BodyShort;
  readonly senderOrganizationId: string;
}

/**
 * Type guard for IMessage objects
 */
export const isIMessage = is<IMessage>(
  arg => arg && isFiscalCode(arg.fiscalCode) && isBodyShort(arg.bodyShort)
);

/**
 * Interface for new Message objects
 */
export interface INewMessage extends IMessage, DocumentDb.NewDocument {
  readonly kind: "INewMessage";
  readonly id: NonEmptyString;
}

/**
 * Interface for retrieved Message objects
 */
export interface IRetrievedMessage
  extends Readonly<IMessage>,
    Readonly<DocumentDb.RetrievedDocument> {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedMessage";
}

/**
 * Message objects shared with trusted applications (i.e. client apps).
 */
export interface IPublicExtendedMessage
  extends LimitedFields<
      IRetrievedMessage,
      "fiscalCode" | "bodyShort" | "senderOrganizationId"
    > {
  readonly kind: "IPublicExtendedMessage";
}

/**
 * Converts a Message to an IPublicExtendedMessage
 */
export function asPublicExtendedMessage<T extends IMessage>(
  message: T
): IPublicExtendedMessage {
  const { fiscalCode, bodyShort, senderOrganizationId } = message;
  return {
    bodyShort,
    fiscalCode,
    kind: "IPublicExtendedMessage",
    senderOrganizationId
  };
}

/**
 * Type guard for IRetrievedMessage objects
 */
export const isIRetrievedMessage = is<IRetrievedMessage>(
  arg =>
    isNonEmptyString(arg.id) &&
    typeof arg._self === "string" &&
    (typeof arg._ts === "string" || typeof arg._ts === "number") &&
    isIMessage(arg)
);

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedMessage {
  return {
    ...result,
    kind: "IRetrievedMessage"
  } as IRetrievedMessage;
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<
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
  ): DocumentDbUtils.IResultIterator<IRetrievedMessage> {
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
}
