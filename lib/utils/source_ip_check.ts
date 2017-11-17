import { isSome } from "fp-ts/lib/Option";
import { IAzureUserAttributes } from "./middlewares/azure_user_attributes";
/*
 * A request wrapper that checks whether the source IP is contained in the
 * CIDRs allowed to make requests.
 */

import CIDRMatcher = require("cidr-matcher");
import { ClientIp } from "./middlewares/client_ip_middleware";
import { IPString } from "./strings";
import { Tuple2 } from "./tuples";

import {
  IResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenNotAuthorized
} from "./response";

/**
 * Whether IP is contained in the provided CIDRs
 */
function isContainedInCidrs(ip: IPString, cidrs: ReadonlySet<string>): boolean {
  const matcher = new CIDRMatcher();
  cidrs.forEach(c => {
    matcher.addNetworkClass(c);
  });
  return matcher.contains(ip);
}

export function checkSourceIpForHandler<P1, O>(
  f: (p1: P1) => Promise<O>,
  e: (p1: P1) => Tuple2<ClientIp, ReadonlySet<string>>
): (p1: P1) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, O>(
  f: (p1: P1, p2: P2) => Promise<O>,
  e: (p1: P1, p2: P2) => Tuple2<ClientIp, ReadonlySet<string>>
): (p1: P1, p2: P2) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, O>(
  f: (p1: P1, p2: P2, p3: P3) => Promise<O>,
  e: (p1: P1, p2: P2, p3: P3) => Tuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4) => Promise<O>,
  e: (p1: P1, p2: P2, p3: P3, p4: P4) => Tuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, P5, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => Promise<O>,
  e: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5
  ) => Tuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, P5, P6, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6) => Promise<O>,
  e: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6
  ) => Tuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

/**
 * Whether the request is coming from an allowed IP.
 *
 * @param handler     The handler to be wrapped
 * @param extractor   A Function that takes the parameters of f and extracts the
 *                    X-Forwarded-For header from the request and the authorized
 *                    CIDRs from the user attributes
 */
export function checkSourceIpForHandler<P1, P2, P3, P4, P5, P6, O>(
  handler: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6) => Promise<O>,
  extractor: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6
  ) => Tuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6
) => Promise<O | IResponseErrorForbiddenNotAuthorized> {
  return (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6) => {
    // extract the x-forwarded-for header and the allowed cidrs from the params
    const x = extractor(p1, p2, p3, p4, p5, p6);
    const maybeClientIp = x.e1;
    const cidrs = x.e2;

    if (
      // we have a client IP and...
      isSome(maybeClientIp) &&
      // ...either no CIDRs setting or client IP is contained in allowed CIDRs
      (cidrs.size === 0 || isContainedInCidrs(maybeClientIp.value, cidrs))
    ) {
      // forward request to handler
      return handler(p1, p2, p3, p4, p5, p6);
    } else {
      // respond with Not Authorized
      return Promise.resolve(ResponseErrorForbiddenNotAuthorized);
    }
  };
}

/**
 * A helper for building the Tuple2 needed by checkSourceIpForHandler.
 *
 * @param request         The Express Request object
 * @param userAttributes  The IAzureUserAttributes object provided by
 *                        AzureUserAttributesMiddleware.
 */
export function clientIPAndCidrTuple(
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes
): Tuple2<ClientIp, ReadonlySet<string>> {
  return Tuple2(clientIp, userAttributes.service.authorizedCIDRs);
}
