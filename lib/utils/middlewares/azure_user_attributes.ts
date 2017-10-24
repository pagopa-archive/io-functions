/*
 * A middle ware that extracts custom user attributes from the request.
 */

import * as winston from "winston";

import { left, right } from "../either";
import { EmailString, toEmailString, toNonEmptyString } from "../strings";

import { IService, ServiceModel } from "../../models/service";
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

const HEADER_USER_SUBSCRIPTION_KEY = "x-subscription-id";

/**
 * The attributes extracted from the user's "Note"
 */
export interface IAzureUserAttributes {
  readonly kind: "IAzureUserAttributes";
  // the email of the registered user
  readonly email: EmailString;
  // the service associated to the user
  readonly service: IService;
}

/**
 * A middleware that will extract custom user attributes from the request.
 *
 * The middleware expects the following headers:
 *
 *   x-subscription-id:     The user's subscription id, used to retrieve
 *                          the associated Service
 *
 * On success, the middleware provides an IUserAttributes.
 *
 */
export function AzureUserAttributesMiddleware(
  serviceModel: ServiceModel
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

    const maybeUserSubscriptionIdHeader = toNonEmptyString(
      request.header(HEADER_USER_SUBSCRIPTION_KEY)
    );

    if (maybeUserSubscriptionIdHeader.isEmpty) {
      return left(
        ResponseErrorInternal(
          `Missing or empty ${HEADER_USER_SUBSCRIPTION_KEY} header`
        )
      );
    }

    const subscriptionId = maybeUserSubscriptionIdHeader.get;

    const errorOrMaybeService = await serviceModel.findBySubscriptionId(
      subscriptionId
    );

    if (errorOrMaybeService.isLeft) {
      winston.error(
        `Error while retrieving service|${subscriptionId}|${errorOrMaybeService.left}`
      );
      return left(
        ResponseErrorQuery(
          `Error while retrieving service`,
          errorOrMaybeService.left
        )
      );
    }

    const maybeService = errorOrMaybeService.right;

    if (maybeService.isEmpty) {
      winston.error(`Service not found|${subscriptionId}`);
      return left(ResponseErrorForbiddenNotAuthorized);
    }

    // const authorizedRecipients = service.authorizedRecipients
    //   ? new Set(service.authorizedRecipients.filter(isFiscalCode))
    //   : new Set();

    const authInfo: IAzureUserAttributes = {
      email: userEmail,
      kind: "IAzureUserAttributes",
      service: maybeService.get
    };

    return right(authInfo);
  };
}
