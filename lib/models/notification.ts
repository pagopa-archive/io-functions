/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */

import * as DocumentDb from "documentdb";
import is from "ts-is";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option } from "ts-option";

import { EmailAddress, isEmailAddress } from "../api/definitions/EmailAddress";
import { FiscalCode, isFiscalCode } from "../api/definitions/FiscalCode";
import {
  isNotificationChannelStatus,
  NotificationChannelStatus
} from "../api/definitions/NotificationChannelStatus";

import { Either } from "../utils/either";
import { isNonEmptyString, NonEmptyString } from "../utils/strings";

/**
 * All possible sources that can provide the address of the recipient.
 */
export enum NotificationAddressSource {
  // the notification address comes from the user profile
  PROFILE_ADDRESS = "PROFILE_ADDRESS",
  // the notification address was provided as default address by the sender
  DEFAULT_ADDRESS = "DEFAULT_ADDRESS"
}

/**
 * Type guard for NotificationAddressSource
 */
export const isNotificationAddressSource = is<NotificationAddressSource>(
  arg => NotificationAddressSource[arg] !== undefined
);

/**
 * Attributes for the email channel
 */
export interface INotificationChannelEmail {
  readonly status: NotificationChannelStatus;
  readonly addressSource: NotificationAddressSource;
  readonly toAddress: EmailAddress;
  readonly fromAddress?: EmailAddress;
}

/**
 * Type guard for INotificationChannelEmail objects
 */
export const isINotificationChannelEmail = is<INotificationChannelEmail>(
  arg =>
    isEmailAddress(arg.toAddress) &&
    isNotificationChannelStatus(arg.status) &&
    isNotificationAddressSource(arg.addressSource) &&
    (!arg.fromAddress || isEmailAddress(arg.fromAddress))
);

/**
 * Base interface for Notification objects
 */
export interface INotification {
  readonly fiscalCode: FiscalCode;
  readonly messageId: NonEmptyString;
  readonly emailNotification?: INotificationChannelEmail;
}

/**
 * Type guard for INotification objects
 */
export const isINotification = is<INotification>(
  arg =>
    isFiscalCode(arg.fiscalCode) &&
    isNonEmptyString(arg.messageId) &&
    (!arg.emailNotification ||
      isINotificationChannelEmail(arg.emailNotification))
);

/**
 * Interface for new Notification objects
 */
export interface INewNotification
  extends INotification,
    DocumentDb.NewDocument {
  readonly id: NonEmptyString;
  readonly kind: "INewNotification";
}

/**
 * Interface for retrieved Notification objects
 */
export interface IRetrievedNotification
  extends Readonly<INotification>,
    Readonly<DocumentDb.RetrievedDocument> {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedNotification";
}

function toBaseType(o: IRetrievedNotification): INotification {
  return {
    emailNotification: o.emailNotification,
    fiscalCode: o.fiscalCode,
    messageId: o.messageId
  };
}

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): IRetrievedNotification {
  return {
    ...result,
    kind: "IRetrievedNotification"
  } as IRetrievedNotification;
}

/**
 * A model for handling Notifications
 */
export class NotificationModel extends DocumentDbModel<
  INotification,
  INewNotification,
  IRetrievedNotification
> {
  // tslint:disable-next-line:readonly-keyword
  protected dbClient: DocumentDb.DocumentClient;
  // tslint:disable-next-line:readonly-keyword
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Notification model
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
   * Returns all the Notifications for the provided message
   *
   * @param messageId The Id of the message
   */
  public findNotificationForMessage(
    messageId: string
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedNotification>>> {
    return DocumentDbUtils.queryOneDocument(this.dbClient, this.collectionUri, {
      parameters: [
        {
          name: "@messageId",
          value: messageId
        }
      ],
      query: "SELECT * FROM notifications n WHERE (n.messageId = @messageId)"
    });
  }
}
