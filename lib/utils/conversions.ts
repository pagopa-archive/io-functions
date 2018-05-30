import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { TaxCode } from "../api/definitions/TaxCode";
import { NotificationStatusId } from "../models/notification_status";
import { ModelId } from "./documentdb_model_versioned";

/**
 * Converts a TaxCode to a ModelId.
 *
 * Note that this is always possible since a valid TaxCode is
 * also a valid ModelId.
 */
export function taxCodeToModelId(o: TaxCode): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a NonEmptyString to a ModelId.
 *
 * Note that this is always possible since a valid NonEmptyString is
 * also a valid ModelId.
 */
export function nonEmptyStringToModelId(o: NonEmptyString): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a NotificationStatusId to a ModelId.
 *
 * Note that this is always possible since a valid NotificationStatusId is
 * also a valid ModelId.
 */
export function notificationStatusIdToModelId(
  o: NotificationStatusId
): ModelId {
  return (o as string) as ModelId;
}
