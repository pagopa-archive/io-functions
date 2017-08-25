import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";

/**
 * Base interface for Message objects
 */
export interface IMessage {
  fiscalCode: FiscalCode;
  bodyShort: string;
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
export interface INewMessage extends IMessage, DocumentDb.NewDocument { }

/**
 * Interface for retrieved Message objects
 */
interface IRetrievedMessageRW extends IMessage, DocumentDb.RetrievedDocument { }

/**
 * Read-only interface for retrieved Message objects
 */
export type IRetrievedMessage = Readonly<IRetrievedMessageRW>;

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
    this.dbClient = dbClient;
    this.collectionUrl = collectionUrl;
  }

  /**
   * Creates a new Message
   *
   * @param message The new Message
   */
  public async createMessage(message: INewMessage): Promise<IRetrievedMessage> {
    const createdDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      message,
    );
    return createdDocument;
  }

  /**
   * Returns the message associated to the provided message ID
   *
   * @param messageId The ID of the message
   */
  public findMessage(fiscalCode: FiscalCode, messageId: string): Promise<IRetrievedMessage | null> {
    const documentUrl = DocumentDbUtils.getDocumentUrl(
      this.collectionUrl,
      messageId,
    );
    return new Promise((resolve, reject) => {
      // To properly handle "not found" case vs other errors
      // we need to handle the Promise returned by readDocument
      // to be able to catch the 404 error in case the document
      // does not exist and resolve the outer Promise to null.
      DocumentDbUtils.readDocument<IMessage>(
        this.dbClient,
        documentUrl,
        fiscalCode,
      ).then(
        (document) => resolve(document),
        (error: DocumentDb.QueryError) => {
          if (error.code === 404) {
            resolve(null);
          } else {
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public async findMessageForRecipient(fiscalCode: FiscalCode, messageId: string): Promise<IRetrievedMessage | null> {
    const message = await this.findMessage(fiscalCode, messageId);
    if (message != null && message.fiscalCode === fiscalCode) {
      return message;
    } else {
      return null;
    }
  }

  /**
   * Returns the messages for the provided fiscal code
   *
   * @param fiscalCode The fiscal code of the recipient
   */
  public findMessages(fiscalCode: FiscalCode): DocumentDbUtils.IResultIterator<IRetrievedMessage[]> {
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
