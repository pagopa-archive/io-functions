
import { Option, option } from "ts-option";
import ulid = require("ulid");
import { IRetrievedMessage } from "../models/message";
import {
  INewNotification,
  INotificationChannelEmail,
  IRetrievedNotification, NotificationChannelStatus,
  NotificationModel,
} from "../models/notification";
import { ProfileModel } from "../models/profile";
import { Either, left, right } from "../utils/either";
import { toNonEmptyString } from "../utils/strings";

/**
 * Bad things that can happen while we process the message
 */
export enum ProcessingError {

  // a transient error, e.g. database is not available
  TRANSIENT,

  // user has no profile, can't deliver a notification
  NO_PROFILE,

}

/**
 * Handles the retrieved message by looking up the associated profile and
 * creating a Notification record that has all the channels configured.
 *
 * TODO: emit to all channels (push notification, sms, etc...)
 */
export async function handleMessage(
    profileModel: ProfileModel,
    notificationModel: NotificationModel,
    retrievedMessage: IRetrievedMessage,
): Promise<Either<ProcessingError, IRetrievedNotification>> {
  // async fetch of profile data associated to the fiscal code the message
  // should be delivered to
  const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(retrievedMessage.fiscalCode);

  if (errorOrMaybeProfile.isRight) {
    // query succeeded, let's see if we have a result
    const maybeProfile = errorOrMaybeProfile.right;
    if (maybeProfile.isDefined) {
      // yes we have a matching profile
      const profile = maybeProfile.get;
      // we got a valid profile associated to the message, we can trigger
      // notifications on the configured channels.

      const maybeEmailNotification: Option<INotificationChannelEmail> = option(profile.email).map((email) => {
        // in case an email address is configured in the profile, we can
        // trigger an email notification event
        const emailNotification: INotificationChannelEmail = {
          status: NotificationChannelStatus.NOTIFICATION_QUEUED,
          toAddress: email,
        };
        return emailNotification;
      });

      // create a new Notification object with the configured notifications
      const notification: INewNotification = {
        emailNotification: maybeEmailNotification.isDefined ? maybeEmailNotification.get : undefined,
        fiscalCode: profile.fiscalCode,
        id: toNonEmptyString(ulid()).get,
        kind: "INewNotification",
        messageId: retrievedMessage.id,
      };

      // save the Notification
      const result = await notificationModel.create(notification, notification.messageId);

      if (result.isRight) {
        // save succeeded, return the saved Notification
        return right(result.right);
      } else {
        // saved failed, fail with a transient error
        // TODO: we could check the error to see if it's actually transient
        return left(ProcessingError.TRANSIENT);
      }

    } else {
      // query succeeded but no profile was found
      return(left(ProcessingError.NO_PROFILE));
    }
  } else {
    // query failed
    return left(ProcessingError.TRANSIENT);
  }

}
