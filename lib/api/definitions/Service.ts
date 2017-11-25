// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isServiceId, ServiceId } from "./ServiceId";
import { isServiceName, ServiceName } from "./ServiceName";
import { isOrganizationName, OrganizationName } from "./OrganizationName";
import { isDepartmentName, DepartmentName } from "./DepartmentName";
import { isCIDR, CIDR } from "./CIDR";
import { isFiscalCode, FiscalCode } from "./FiscalCode";

/**
 * A Service tied to an user's subscription.
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface Service {
  readonly service_id: ServiceId;

  readonly service_name: ServiceName;

  readonly organization_name: OrganizationName;

  readonly department_name: DepartmentName;

  readonly authorized_cidrs: ReadonlyArray<CIDR>;

  readonly authorized_recipients: ReadonlyArray<FiscalCode>;

  readonly version?: number;

  readonly id?: string;
}

export function isService(arg: any): arg is Service {
  return (
    arg &&
    isServiceId(arg.service_id) &&
    isServiceName(arg.service_name) &&
    isOrganizationName(arg.organization_name) &&
    isDepartmentName(arg.department_name) &&
    arg.authorized_cidrs.every(isCIDR) &&
    arg.authorized_recipients.every(isFiscalCode) &&
    (arg.version === undefined ||
      arg.version === null ||
      typeof arg.version === "number") &&
    (arg.id === undefined || arg.id === null || typeof arg.id === "string") &&
    true
  );
}

export function toService(arg: any): Option<Service> {
  return fromNullable(arg).filter(isService);
}
