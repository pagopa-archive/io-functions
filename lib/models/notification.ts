/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option, some } from "ts-option";

import { Either, right } from "../utils/either";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";

/**
 * A notification can be sent over multiple channels and each channel
 * can be in a certain status describing.
 */
export const enum NotificationChannelStatus {
  // still processing the notification
  NOTIFICATION_QUEUED = "QUEUED",
  // the email has been sent to the channel
  NOTIFICATION_SENT_TO_CHANNEL = "SENT_TO_CHANNEL",
}

/**
 * Attributes for the email channel
 */
export interface INotificationChannelEmail {
  readonly status: NotificationChannelStatus;
  readonly fromAddress?: string;
  readonly toAddress: string;
}

/**
 * Base interface for Notification objects
 */
export interface INotification {
  readonly fiscalCode: FiscalCode;
  readonly messageId: string;
  readonly emailNotification?: INotificationChannelEmail;
}

/**
 * Type guard for INotification objects
 */
// tslint:disable-next-line:no-any
export function isINotification(arg: any): arg is INotification {
  return isFiscalCode(arg.fiscalCode) &&
    typeof arg.messageId === "string" && arg.messageId.length > 0;
}

/**
 * Interface for new Notification objects
 */
export interface INewNotification extends INotification, DocumentDb.NewDocument {
  readonly kind: "INewNotification";
}

/**
 * Interface for retrieved Notification objects
 */
export interface IRetrievedNotification extends Readonly<INotification>, Readonly<DocumentDb.RetrievedDocument> {
  readonly kind: "IRetrievedNotification";
}

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedNotification {
  return ({
    ...result,
    kind: "IRetrievedNotification",
  } as IRetrievedNotification);
}

/**
 * A model for handling Notifications
 */
export class NotificationModel extends DocumentDbModel<INewNotification, IRetrievedNotification> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Notification model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri) {
    super();
    // tslint:disable-next-line:no-object-mutation
    this.toRetrieved = toRetrieved;
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUri = collectionUrl;
  }

  /**
   * Updates an existing Notification
   */
  public async update(
    messageId: string,
    notificationId: string,
    f: (current: INotification) => INotification,
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedNotification>>> {
    // fetch the notification
    const errorOrMaybeCurrent = await this.find(notificationId, messageId);
    if (errorOrMaybeCurrent.isLeft) {
      // if the query returned an error, forward it
      return errorOrMaybeCurrent;
    }

    const maybeCurrent = errorOrMaybeCurrent.right;

    if (maybeCurrent.isEmpty) {
      return right(maybeCurrent);
    }

    const currentNotification = maybeCurrent.get;

    const updatedNotification = f({
      emailNotification: currentNotification.emailNotification,
      fiscalCode: currentNotification.fiscalCode,
      messageId: currentNotification.messageId,
    });

    const newNotificationDocument: INewNotification = {
      ...updatedNotification,
      id: currentNotification.id,
      kind: "INewNotification",
    };

    const kindlessNewNotificationDocument = Object.assign(
      Object.assign({}, newNotificationDocument), { kind: undefined },
    );

    const maybeReplacedDocument = await DocumentDbUtils.replaceDocument<INotification>(
      this.dbClient,
      DocumentDbUtils.getDocumentUri(this.collectionUri, currentNotification.id),
      kindlessNewNotificationDocument,
      messageId,
    );

    return maybeReplacedDocument.mapRight((replacedDocument) => some({
      ...replacedDocument,
      kind: "IRetrievedNotification",
    } as IRetrievedNotification));
  }

  /**
   * Returns all the Notifications for the provided message
   *
   * @param messageId The Id of the message
   */
  public findNotificationForMessage(
    messageId: string,
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedNotification>>> {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [{
          name: "@messageId",
          value: messageId,
        }],
        query: "SELECT * FROM notifications n WHERE (n.messageId = @messageId)",
      },
    );
  }

}
