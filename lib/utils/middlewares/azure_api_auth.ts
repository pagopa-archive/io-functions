/*
 * A middle ware that extracts authentication information from the
 * request.
 */

import { none, option, Option, some } from "ts-option";

import { left, right } from "../either";

import { IRequestMiddleware } from "../request_middleware";
import {
  IResponseErrorForbidden,
  ResponseErrorForbidden,
} from "../response";

/**
 * Enumerates all supported user groups
 */
export enum UserGroup {
  Administrators = "Administrators",
  Developers = "Developers",
  TrustedApplications = "TrustedApplications",
}

/**
 * Looks up a UserGroup by name
 */
function toUserGroup(name: string): Option<UserGroup> {
  switch (name) {
    case UserGroup.Developers: return some(UserGroup.Developers);
    case UserGroup.TrustedApplications: return some(UserGroup.TrustedApplications);
    default: return none;
  }
}

/**
 * Azure authorization info
 */
export interface IAzureApiAuthorization {
  kind: "IAzureApiAuthorization";
  groups: Set<UserGroup>;
}

/**
 * Returns an array of group names from a groups header.
 *
 * Expects a comma separated list of group names.
 */
function getGroupsFromHeader(groupsHeader: string): Set<UserGroup> {
  return new Set(
    groupsHeader
      .split(",")
      .map(toUserGroup)
      .filter((g) => g.isDefined)
      .map((g) => g.get),
  );
}

/**
 * A middleware that will extract the Azure API Management authentication
 * information from the request.
 *
 * The middleware expects the following headers:
 *
 *   x-user-groups:   A comma separated list of names of Azure API Groups
 *
 * On success, the middleware generates an IAzureApiAuthorization, on failure
 * it triggers a ResponseErrorForbidden.
 *
 */
export function AzureApiAuthMiddleware(
  allowedGroups: Set<UserGroup>,
): IRequestMiddleware<IResponseErrorForbidden, IAzureApiAuthorization> {
  return (request) => new Promise((resolve) => {
    // to correctly process the request, we must associate the correct
    // authorizations to the user that made the request; to do so, we
    // need to extract the groups associated to the authenticated user
    // from the x-user-groups header, generated by the Azure API Management
    // proxy.
    option(request.header("x-user-groups"))
      .map(getGroupsFromHeader) // extract the groups from the header
      .filter((hs) => hs.size > 0) // filter only if set of groups is non empty
      .map((groups) => {
        // now we have some groups
        // TODO: map to group types

        // whether the user is part of a specific group
        const userHasOneGroup = (name: UserGroup) => groups.has(name);
        // whether the user is part of at least an allowed group
        const userHasAnyAllowedGroup = Array.from(allowedGroups).findIndex(userHasOneGroup) > -1;

        if (userHasAnyAllowedGroup) {
          const authInfo: IAzureApiAuthorization = {
            groups,
            kind: "IAzureApiAuthorization",
          };

          resolve(right(authInfo));
        } else {
          // or else no valid groups
          resolve(left(ResponseErrorForbidden("You are not allowed here.")));
        }

      }).getOrElse(() => {
        // or else no valid groups
        resolve(left(ResponseErrorForbidden("You are not part of any group.")));
      });

  });
}
