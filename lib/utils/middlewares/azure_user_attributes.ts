/*
 * A middle ware that extracts custom user attributes from the request.
 */

import * as jsYaml from "js-yaml";
import { is } from "ts-is";
import { none, option, Option } from "ts-option";
import * as winston from "winston";

import { left, right } from "../either";
import {
  EmailString,
  isNonEmptyString,
  NonEmptyString,
  toEmailString,
  toNonEmptyString
} from "../strings";

import { IOrganization, OrganizationModel } from "../../models/organization";
import { IRequestMiddleware } from "../request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorQuery,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorQuery
} from "../response";

// The user email will be passed in this header by the API Gateway
const HEADER_USER_EMAIL = "x-user-email";

// The user "note" attribute will be passed in this header by the API Gateway
// The "note" attribute will be URI encoded
const HEADER_USER_NOTE = "x-user-note";

/**
 * The attributes that can be defined in the user's "Note" field.
 * This is the YAML representation of those attributes.
 */
interface IAzureUserNote {
  readonly organizationId: NonEmptyString;
  readonly departmentName: NonEmptyString;
  readonly serviceName: NonEmptyString;
}

/**
 * Type guard for IAzureUserNote
 */
const isIAzureUserNote = is<IAzureUserNote>(
  arg =>
    arg.organizationId &&
    isNonEmptyString(arg.organizationId) &&
    arg.departmentName &&
    isNonEmptyString(arg.departmentName) &&
    arg.serviceName &&
    isNonEmptyString(arg.serviceName)
);

// tslint:disable-next-line:no-any
function toIAzureUserNote(arg: any): Option<IAzureUserNote> {
  return option(arg).filter(isIAzureUserNote);
}

/**
 * Attempts to deserialize a IAzureUserNote from a YAML string
 */
function parseIAzureUserNoteFromYaml(data: string): Option<IAzureUserNote> {
  try {
    const yaml = jsYaml.safeLoad(data);
    return toIAzureUserNote(yaml);
  } catch (e) {
    return none;
  }
}

/**
 * Attempts to deserialize a IAzureUserNote from an URI encoded YAML string
 */
function parseIAzureUserNoteFromUriEncodedYaml(
  data: string
): Option<IAzureUserNote> {
  const decoded = decodeURIComponent(data);
  return parseIAzureUserNoteFromYaml(decoded);
}

/**
 * The attributes extracted from the user's "Note"
 */
export interface IAzureUserAttributes {
  readonly kind: "IAzureUserAttributes";
  // the email of the registered user
  readonly email: EmailString;
  // the organization associated to the user
  readonly organization: IOrganization;
  // the name of the department within the organization
  readonly departmentName: NonEmptyString;
  // the name of the service
  readonly serviceName: NonEmptyString;
}

/**
 * A middleware that will extract custom user attributes from the request.
 *
 * The middleware expects the following headers:
 *
 *   x-user-note:     The Note field associated to the user (URL encoded
 *                    using .NET Uri.EscapeUriString().
 *
 * The Note field is optional, and when defined is expected to be a YAML data
 * structure providing the following attributes associated to the authenticated
 * user:
 *
 *   organizationId:  The identifier of the organization of this user
 *
 * On success, the middleware provides an IUserAttributes.
 *
 */
export function AzureUserAttributesMiddleware(
  organizationModel: OrganizationModel
): IRequestMiddleware<
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorQuery
  | IResponseErrorInternal,
  IAzureUserAttributes
> {
  return async request => {
    const maybeUserEmail = toEmailString(request.header(HEADER_USER_EMAIL));

    if (maybeUserEmail.isEmpty) {
      return left(
        ResponseErrorInternal(
          `Missing, empty or invalid ${HEADER_USER_EMAIL} header`
        )
      );
    }

    const userEmail = maybeUserEmail.get;

    const maybeUserNoteHeader = toNonEmptyString(
      request.header(HEADER_USER_NOTE)
    );

    if (maybeUserNoteHeader.isEmpty) {
      return left(
        ResponseErrorInternal(`Missing or empty ${HEADER_USER_NOTE} header`)
      );
    }

    const userNoteHeader = maybeUserNoteHeader.get;

    // now we check whether some custom user attributes have been set
    // through the x-user-note header (filled from the User Note attribute)
    const maybeUserAttributes = parseIAzureUserNoteFromUriEncodedYaml(
      userNoteHeader
    );

    if (maybeUserAttributes.isEmpty) {
      return left(
        ResponseErrorInternal(
          `Cannot parse user attributes from ${HEADER_USER_NOTE} header`
        )
      );
    }

    const userAttributes = maybeUserAttributes.get;

    const errorOrMaybeOrganization = await organizationModel.findByOrganizationId(
      userAttributes.organizationId
    );

    if (errorOrMaybeOrganization.isLeft) {
      winston.error(
        `Error while retrieving organization|${userAttributes.organizationId}|${errorOrMaybeOrganization.left}`
      );
      return left(
        ResponseErrorQuery(
          `Error while retrieving organization|${userAttributes.organizationId}`,
          errorOrMaybeOrganization.left
        )
      );
    }

    const maybeOrganization = errorOrMaybeOrganization.right;

    if (maybeOrganization.isEmpty) {
      winston.error(`Organization not found|${userAttributes.organizationId}`);
      return left(ResponseErrorForbiddenNotAuthorized);
    }

    const organization = maybeOrganization.get;

    const authInfo: IAzureUserAttributes = {
      departmentName: userAttributes.departmentName,
      email: userEmail,
      kind: "IAzureUserAttributes",
      organization,
      serviceName: userAttributes.serviceName
    };

    return right(authInfo);
  };
}
