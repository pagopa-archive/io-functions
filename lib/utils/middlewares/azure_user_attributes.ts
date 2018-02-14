/*
 * A middle ware that extracts custom user attributes from the request.
 */
import * as winston from "winston";

import { isLeft, left, right } from "fp-ts/lib/Either";

import { isNone } from "fp-ts/lib/Option";

import { EmailString, NonEmptyString } from "../strings";

import { Service, ServiceModel } from "../../models/service";
import { IRequestMiddleware } from "../request_middleware";
import {
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
  readonly service: Service;
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
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorQuery"
  | "IResponseErrorInternal",
  IAzureUserAttributes
> {
  return async request => {
    const errorOrUserEmail = EmailString.decode(
      request.header(HEADER_USER_EMAIL)
    );

    if (isLeft(errorOrUserEmail)) {
      return left(
        ResponseErrorInternal(
          `Missing, empty or invalid ${HEADER_USER_EMAIL} header`
        )
      );
    }

    const userEmail = errorOrUserEmail.value;

    const errorOrUserSubscriptionId = NonEmptyString.decode(
      request.header(HEADER_USER_SUBSCRIPTION_KEY)
    );

    if (isLeft(errorOrUserSubscriptionId)) {
      return left(
        ResponseErrorInternal(
          `Missing or empty ${HEADER_USER_SUBSCRIPTION_KEY} header`
        )
      );
    }

    const subscriptionId = errorOrUserSubscriptionId.value;

    // serviceId equals subscriptionId
    const errorOrMaybeService = await serviceModel.findOneByServiceId(
      subscriptionId
    );

    if (isLeft(errorOrMaybeService)) {
      winston.error(
        `No service found for subscription|${subscriptionId}|${JSON.stringify(
          errorOrMaybeService.value
        )}`
      );
      return left(
        ResponseErrorQuery(
          `Error while retrieving the service tied to the provided subscription id`,
          errorOrMaybeService.value
        )
      );
    }

    const maybeService = errorOrMaybeService.value;

    if (isNone(maybeService)) {
      winston.error(
        `AzureUserAttributesMiddleware|Service not found|${subscriptionId}`
      );
      return left(ResponseErrorForbiddenNotAuthorized);
    }

    const authInfo: IAzureUserAttributes = {
      email: userEmail,
      kind: "IAzureUserAttributes",
      service: maybeService.value
    };

    return right(authInfo);
  };
}
