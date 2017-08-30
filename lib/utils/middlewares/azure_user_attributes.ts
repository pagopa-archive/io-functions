/*
 * A middle ware that extracts custom user attributes from the request.
 */

import * as jsYaml from "js-yaml";
import { none, option, Option, some } from "ts-option";

import { left, right } from "../either";

import { IRetrievedOrganization, OrganizationModel } from "../../models/organization";
import { IRequestMiddleware } from "../request_middleware";
import {
  IResponseErrorForbidden,
  IResponseErrorGeneric,
  ResponseErrorGeneric,
} from "../response";
import { isModelId, ModelId } from "../versioned_model";

interface IAzureUserNote {
  organizationId?: string;
}

export interface IAzureUserAttributes {
  kind: "IAzureUserAttributes";
  organization?: IRetrievedOrganization;
}

/**
 * Attempts to fetch the Organization associated to the user in the
 * user custom attributes.
 */
function getUserOrganization(
  organizationModel: OrganizationModel,
  azureUserAttributes: IAzureUserNote,
): Promise<Option<IRetrievedOrganization>> {
  return option(azureUserAttributes.organizationId)
    .flatMap<ModelId>((maybeOrganizationId) => {
      if (maybeOrganizationId !== undefined && isModelId(maybeOrganizationId)) {
        return some(maybeOrganizationId);
      } else {
        return none;
      }
    }).map((organizationId) => {
      return organizationModel.findLastVersionById(organizationId)
        .then((result) => {
          if (result !== null) {
            return some(result);
          } else {
            return none;
          }
        });
    }).getOrElse(() => Promise.resolve(none));
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
 *   organizationId:  The identifier of the organization of this user (optional)
 *
 * On success, the middleware provides an IUserAttributes.
 *
 */
export function AzureUserAttributesMiddleware(
  organizationModel: OrganizationModel,
): IRequestMiddleware<IResponseErrorForbidden | IResponseErrorGeneric, IAzureUserAttributes> {
  return (request) => new Promise((resolve) => {

    // now we check whether some custom user attributes have been set
    // through the x-user-note header (filled from the User Note attribute)
    const userAttributes = option(request.header("x-user-note"))
      // the header is a URI encoded string (since it may contain new lines
      // and special chars), so we must first decode it.
      .map(decodeURIComponent)
      .flatMap<IAzureUserNote>((y) => {
        // then we try to parse the YAML string
        try {
          // all IUserAttributes are optional, so we can safely cast
          // the object to it
          const yaml = jsYaml.safeLoad(y) as IAzureUserNote;
          return some(yaml);
        } catch (e) {
          return none;
        }
      });

    // now we can attempt to retrieve the Organization associated to the
    // user, in case it was set in the custom attribute
    const userOrg: Promise<Option<IRetrievedOrganization>> = new Promise((orgResolve, orgReject) => {
      userAttributes
        .map((a) => {
          getUserOrganization(organizationModel, a)
            .then(orgResolve, orgReject);
        })
        .getOrElse(() => orgResolve(none));
    });

    userOrg.then((o) => {
      // we have everything we need, we can now resolve the outer
      // promise with an IAzureApiAuthorization object

      const authInfo: IAzureUserAttributes = {
        kind: "IAzureUserAttributes",
        organization: o.orNull,
      };

      resolve(right(authInfo));
    }, (error) => resolve(left(ResponseErrorGeneric(`Error while fetching organization details|${error}`))));

  });
}
