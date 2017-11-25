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
 * The IP is extracted from the "x-forwarded-for" HTTP header;
 * if x-forwarded-for header is empty, the IP will be null 
 * and the middleware will return None.
 */
export const ClientIpMiddleware: IRequestMiddleware<
  never,
  ClientIp
> = request => {
  const clientIp = requestIp.getClientIp(request);
  winston.debug(`Handling request for client ip|${clientIp}`);
  return Promise.resolve(right<never, ClientIp>(toIPString(clientIp)));
};
