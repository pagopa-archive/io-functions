// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isAdmCidr, AdmCidr } from "./AdmCidr";
import { isAdmFiscalCode, AdmFiscalCode } from "./AdmFiscalCode";

/**
 * A Service tied to an user's subscription.
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface AdmService {
  readonly serviceId: string;

  readonly serviceName: string;

  readonly organizationName: string;

  readonly departmentName: string;

  readonly authorizedCIDRs: ReadonlyArray<AdmCidr>;

  readonly authorizedRecipients: ReadonlyArray<AdmFiscalCode>;

  readonly version?: number;

  readonly id?: string;
}

export function isAdmService(arg: any): arg is AdmService {
  return (
    arg &&
    typeof arg.serviceId === "string" &&
    typeof arg.serviceName === "string" &&
    typeof arg.organizationName === "string" &&
    typeof arg.departmentName === "string" &&
    arg.authorizedCIDRs.every(isAdmCidr) &&
    arg.authorizedRecipients.every(isAdmFiscalCode) &&
    (arg.version === undefined ||
      arg.version === null ||
      typeof arg.version === "number") &&
    (arg.id === undefined || arg.id === null || typeof arg.id === "string") &&
    true
  );
}

export function toAdmService(arg: any): Option<AdmService> {
  return fromNullable(arg).filter(isAdmService);
}
