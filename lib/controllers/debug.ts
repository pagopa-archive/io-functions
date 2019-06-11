/**
 * Handler for debug endpoint
 */

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

import * as express from "express";

import { right } from "fp-ts/lib/Either";

import {
  ClientIp,
  ClientIpMiddleware
} from "../utils/middlewares/client_ip_middleware";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";

import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../utils/middlewares/azure_user_attributes";

import { ServiceModel } from "io-functions-commons/dist/src/models/service";

import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

// simle request middleware that passes the request object for debug purposes
const ExpressRequestMiddleware: IRequestMiddleware<
  never,
  express.Request
> = request => Promise.resolve(right<never, express.Request>(request));

// type definition of the debug endpoint
type GetDebug = (
  request: express.Request,
  clientIp: ClientIp,
  auth: IAzureApiAuthorization,
  attributes: IAzureUserAttributes
) => Promise<IResponseSuccessJson<object>>;

const getDebugHandler: GetDebug = (request, _, auth, userAttributes) => {
  return Promise.resolve(
    ResponseSuccessJson({
      auth: {
        ...auth,
        // must convert the Set to an Array
        // see https://stackoverflow.com/questions/31190885/json-stringify-a-set
        groups: Array.from(auth.groups.values())
      },
      body: request.body,
      headers: request.headers,
      params: request.params,
      user: userAttributes
    })
  );
};

export function GetDebug(serviceModel: ServiceModel): express.RequestHandler {
  const azureApiMiddleware = AzureApiAuthMiddleware(
    new Set([UserGroup.ApiDebugRead])
  );
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    ExpressRequestMiddleware,
    ClientIpMiddleware,
    azureApiMiddleware,
    azureUserAttributesMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(getDebugHandler, (_, c, __, u) => ipTuple(c, u))
    )
  );
}
