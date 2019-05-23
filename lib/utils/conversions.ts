import * as DocumentDbUtils from "io-documentdb-utils";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { FiscalCode } from "../api/definitions/FiscalCode";
import { NotificationStatusId } from "../models/notification_status";

/**
 * Converts a FiscalCode to a ModelId.
 *
 * Note that this is always possible since a valid FiscalCode is
 * also a valid ModelId.
 */
export function fiscalCodeToModelId(
  o: FiscalCode
): DocumentDbUtils.DocumentDbModelVersioned.ModelId {
  return (o as string) as DocumentDbUtils.DocumentDbModelVersioned.ModelId;
}

/**
 * Converts a NonEmptyString to a ModelId.
 *
 * Note that this is always possible since a valid NonEmptyString is
 * also a valid ModelId.
 */
export function nonEmptyStringToModelId(
  o: NonEmptyString
): DocumentDbUtils.DocumentDbModelVersioned.ModelId {
  return (o as string) as DocumentDbUtils.DocumentDbModelVersioned.ModelId;
}

/**
 * Converts a NotificationStatusId to a ModelId.
 *
 * Note that this is always possible since a valid NotificationStatusId is
 * also a valid ModelId.
 */
export function notificationStatusIdToModelId(
  o: NotificationStatusId
): DocumentDbUtils.DocumentDbModelVersioned.ModelId {
  return (o as string) as DocumentDbUtils.DocumentDbModelVersioned.ModelId;
}
