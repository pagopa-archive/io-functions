// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isCIDR, CIDR } from "./CIDR";
import { isFiscalCode, FiscalCode } from "./FiscalCode";

/**
 * A Service tied to an user's subscription.
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface Service {
  readonly serviceId: string;

  readonly serviceName: string;

  readonly organizationName: string;

  readonly departmentName: string;

  readonly authorizedCIDRs: ReadonlyArray<CIDR>;

  readonly authorizedRecipients: ReadonlyArray<FiscalCode>;

  readonly version?: number;

  readonly id?: string;
}

export function isService(arg: any): arg is Service {
  return (
    arg &&
    typeof arg.serviceId === "string" &&
    typeof arg.serviceName === "string" &&
    typeof arg.organizationName === "string" &&
    typeof arg.departmentName === "string" &&
    arg.authorizedCIDRs.every(isCIDR) &&
    arg.authorizedRecipients.every(isFiscalCode) &&
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
