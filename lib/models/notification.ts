/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */
import { enumType } from "../utils/types";

import * as DocumentDb from "documentdb";
import * as t from "io-ts";

import { tag } from "../utils/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { Option } from "fp-ts/lib/Option";

import { EmailAddress } from "../api/definitions/EmailAddress";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { NotificationChannelStatus } from "../api/definitions/NotificationChannelStatus";

import { Either } from "fp-ts/lib/Either";
import { NonEmptyString } from "../utils/strings";

/**
 * All possible sources that can provide the address of the recipient.
 */
export enum NotificationAddressSourceEnum {
  // the notification address comes from the user profile
  PROFILE_ADDRESS = "PROFILE_ADDRESS",
  // the notification address was provided as default address by the sender
  DEFAULT_ADDRESS = "DEFAULT_ADDRESS"
}

export const NotificationAddressSource = enumType<
  NotificationAddressSourceEnum
>(NotificationAddressSourceEnum, "NotificationAddressSource");

export type NotificationAddressSource = NotificationAddressSourceEnum;

/**
 * Attributes for the email channel
 */
export const NotificationChannelEmail = t.intersection([
  t.interface({
    addressSource: NotificationAddressSource,
    status: NotificationChannelStatus,
    toAddress: EmailAddress
  }),
  t.partial({
    fromAddress: EmailAddress
  })
]);

export type NotificationChannelEmail = t.TypeOf<
  typeof NotificationChannelEmail
>;

/**
 * Base interface for Notification objects
 */
export const Notification = t.intersection([
  t.interface({
    fiscalCode: FiscalCode,
    messageId: NonEmptyString
  }),
  t.partial({
    emailNotification: NotificationChannelEmail
  })
]);

export type Notification = t.TypeOf<typeof Notification>;

/**
 * Interface for new Notification objects
 */

interface INewNotificationTag {
  readonly kind: "INewNotification";
}

export const NewNotification = tag<INewNotificationTag>()(
  t.intersection([Notification, DocumentDbUtils.NewDocument])
);

export type NewNotification = t.TypeOf<typeof NewNotification>;

/**
 * Interface for retrieved Notification objects
 */

interface IRetrievedNotificationTag {
  readonly kind: "IRetrievedNotification";
}

export const RetrievedNotification = tag<IRetrievedNotificationTag>()(
  t.intersection([Notification, DocumentDbUtils.RetrievedDocument])
);

export type RetrievedNotification = t.TypeOf<typeof RetrievedNotification>;

function toBaseType(o: RetrievedNotification): Notification {
  return {
    emailNotification: o.emailNotification,
    fiscalCode: o.fiscalCode,
    messageId: o.messageId
  };
}

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedNotification {
  return {
    ...result,
    kind: "IRetrievedNotification"
  } as RetrievedNotification;
}

/**
 * A model for handling Notifications
 */
export class NotificationModel extends DocumentDbModel<
  Notification,
  NewNotification,
  RetrievedNotification
> {
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
    super(dbClient, collectionUrl, toBaseType, toRetrieved);
  }

  /**
   * Returns all the Notifications for the provided message
   *
   * @param messageId The Id of the message
   */
  public findNotificationForMessage(
    messageId: string
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedNotification>>> {
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
