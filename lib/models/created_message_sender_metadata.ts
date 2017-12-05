import * as t from "io-ts";

import { NonEmptyString } from "../utils/strings";

/**
 * Sender metadata associated to a message
 */
export const CreatedMessageEventSenderMetadata = t.interface({
  departmentName: NonEmptyString,
  organizationName: NonEmptyString,
  serviceName: NonEmptyString
});

export type CreatedMessageEventSenderMetadata = t.TypeOf<
  typeof CreatedMessageEventSenderMetadata
>;
