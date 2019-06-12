/**
 * Handler for providing information about the running system
 */

import * as express from "express";

import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../utils/middlewares/azure_user_attributes";

import {
  ClientIp,
  ClientIpMiddleware
} from "../utils/middlewares/client_ip_middleware";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { ServiceModel } from "io-functions-commons/dist/src/models/service";

interface IResponseInfo {
  readonly status: "OK";
}

// type definition of the info endpoint
type GetInfo = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes
) => Promise<IResponseSuccessJson<IResponseInfo>>;

const getInfoHandler: GetInfo = (_, __, ___) => {
  return new Promise(resolve => {
    const info: IResponseInfo = {
      status: "OK"
    };
    resolve(ResponseSuccessJson(info));
  });
};

// TODO: give access to a more specific group, see #150738263
export function GetInfo(serviceModel: ServiceModel): express.RequestHandler {
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const azureApiAuthMiddleware = AzureApiAuthMiddleware(
    new Set([UserGroup.ApiInfoRead])
  );
  const middlewaresWrap = withRequestMiddlewares(
    azureApiAuthMiddleware,
    ClientIpMiddleware,
    azureUserAttributesMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(getInfoHandler, (_, c, u) => ipTuple(c, u))
    )
  );
}
