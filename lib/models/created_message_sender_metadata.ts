import * as t from "io-ts";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { OrganizationFiscalCode } from "../api/definitions/OrganizationFiscalCode";

/**
 * Sender metadata associated to a message
 */
export const CreatedMessageEventSenderMetadata = t.interface({
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  organizationName: NonEmptyString,
  serviceName: NonEmptyString
});

export type CreatedMessageEventSenderMetadata = t.TypeOf<
  typeof CreatedMessageEventSenderMetadata
>;
