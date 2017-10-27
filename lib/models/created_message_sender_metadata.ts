import is from "ts-is";

import { isNonEmptyString, NonEmptyString } from "../utils/strings";

/**
 * Sender metadata associated to a message
 */
export interface ICreatedMessageEventSenderMetadata {
  readonly serviceName: NonEmptyString;
  readonly organizationName: NonEmptyString;
  readonly departmentName: NonEmptyString;
}

export const isICreatedMessageEventSenderMetadata = is<
  ICreatedMessageEventSenderMetadata
>(
  arg =>
    arg.departmentName &&
    isNonEmptyString(arg.departmentName) &&
    arg.serviceName &&
    isNonEmptyString(arg.serviceName)
);
