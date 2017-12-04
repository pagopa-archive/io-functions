// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { ServiceId } from "./ServiceId";
import { ServiceName } from "./ServiceName";
import { OrganizationName } from "./OrganizationName";
import { DepartmentName } from "./DepartmentName";
import { CIDR } from "./CIDR";
import { FiscalCode } from "./FiscalCode";

/**
 * A Service tied to an user's subscription.
 */

import * as t from "io-ts";

// required attributes
const ServiceR = t.interface({
  service_id: ServiceId,

  service_name: ServiceName,

  organization_name: OrganizationName,

  department_name: DepartmentName,

  authorized_cidrs: t.readonlyArray(CIDR),

  authorized_recipients: t.readonlyArray(FiscalCode)
});

// optional attributes
const ServiceO = t.partial({
  version: t.number,

  id: t.string
});

export const Service = t.intersection([ServiceR, ServiceO]);

export type Service = t.TypeOf<typeof Service>;
