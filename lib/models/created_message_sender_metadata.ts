import is from "ts-is";

import { NonEmptyString } from "../utils/strings";

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
    NonEmptyString.is(arg.departmentName) &&
    arg.serviceName &&
    NonEmptyString.is(arg.serviceName)
);
