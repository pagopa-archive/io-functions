import is from "ts-is";

import { isNonEmptyString, NonEmptyString } from "../utils/strings";

/**
 * Sender metadata associated to a message
 */
export interface ICreatedMessageEventSenderMetadata {
  readonly organizationName: NonEmptyString;
  readonly departmentName: NonEmptyString;
  readonly serviceName: NonEmptyString;
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
