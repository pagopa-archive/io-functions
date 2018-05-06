/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */
import { enumType, pick } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as t from "io-ts";

import { tag } from "italia-ts-commons/lib/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { EmailAddress } from "../api/definitions/EmailAddress";
import { FiscalCode } from "../api/definitions/FiscalCode";

import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { HttpsUrl } from "../api/definitions/HttpsUrl";
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { ObjectIdGenerator } from "../utils/strings";

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
 * Base interface for Notification objects
 */
export const NotificationBase = t.interface({
  fiscalCode: FiscalCode,
  messageId: NonEmptyString
});

// Email Notification

export const NotificationChannelEmail = t.interface({
  [NotificationChannelEnum.EMAIL]: t.intersection([
    t.interface({
      addressSource: NotificationAddressSource,
      toAddress: EmailAddress
    }),
    t.partial({
      fromAddress: EmailAddress
    })
  ])
});
export type NotificationChannelEmail = t.TypeOf<
  typeof NotificationChannelEmail
>;

export const EmailNotification = t.interface({
  ...NotificationBase.props,
  channel: NotificationChannelEmail
});
export type EmailNotification = t.TypeOf<typeof EmailNotification>;

// Webhook Notification

export const NotificationChannelWebhook = t.interface({
  [NotificationChannelEnum.WEBHOOK]: t.interface({
    url: HttpsUrl
  })
});
export type NotificationChannelWebhook = t.TypeOf<
  typeof NotificationChannelWebhook
>;

export const WebhookNotification = t.interface({
  ...NotificationBase.props,
  channel: NotificationChannelWebhook
});
export type WebhookNotification = t.TypeOf<typeof WebhookNotification>;

// All notification channels possible metadata.

export const NotificationChannelMeta = t.union([
  NotificationChannelEmail,
  NotificationChannelWebhook
]);
export type NotificationChannelMeta = t.TypeOf<typeof NotificationChannelMeta>;

// Generic Notification object

export const Notification = t.union([WebhookNotification, EmailNotification]);
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
 * Factory method to make NewNotification objects
 */
export function createNewNotification(
  ulidGenerator: ObjectIdGenerator,
  notification: Notification
): NewNotification {
  return {
    id: ulidGenerator(),
    kind: "INewNotification",
    ...notification
  };
}

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

/* istanbul ignore next */
function toBaseType(o: RetrievedNotification): Notification {
  // this cast is due to a typescript limitation inferring union types
  // see https://github.com/gcanti/io-ts/issues/169
  return pick(["fiscalCode", "messageId", "channel"], o) as Notification;
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
   * Returns the Notification object associated to the provided message.
   *
   * @param messageId The Id of the message
   */
  /* istanbul ignore next */
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
