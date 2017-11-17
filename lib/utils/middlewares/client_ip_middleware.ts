import { right } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as requestIp from "request-ip";
import { IPString, toIPString } from "../strings";

import { IRequestMiddleware } from "../request_middleware";

export type ClientIp = Option<IPString>;

/**
 * A middleware that extracts the client IP from the request
 */
export const ClientIpMiddleware: IRequestMiddleware<
  never,
  ClientIp
> = request => {
  const clientIp = requestIp.getClientIp(request);
  return Promise.resolve(right<never, ClientIp>(toIPString(clientIp)));
};
