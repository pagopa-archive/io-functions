import { right } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as requestIp from "request-ip";
import { IPString, toIPString } from "../strings";

import { IRequestMiddleware } from "../request_middleware";

export type ClientIp = Option<IPString>;

import * as winston from "winston";

/**
 * A middleware that extracts the client IP from the request.
 *
 * The algorithm to extract the IP is documented here:
 * https://www.npmjs.com/package/request-ip#how-it-works
 *
 * If you call Functions logic bypassing the API gateway
 * the IP will be null and the middleware will return None.
 */
export const ClientIpMiddleware: IRequestMiddleware<
  never,
  ClientIp
> = request => {
  const clientIp = requestIp.getClientIp(request);
  winston.debug(`Handling request for client IP|${clientIp}`);
  return Promise.resolve(right<never, ClientIp>(toIPString(clientIp)));
};
