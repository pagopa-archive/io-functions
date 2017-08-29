/**
 * Handler for debug endpoint
 */

import * as express from "express";

import { right } from "../utils/either";

import { IRequestMiddleware, withRequestMiddlewares, wrapRequestHandler } from "../utils/request_middleware";

import { AzureApiAuthMiddleware, IAzureApiAuthorization } from "../utils/middlewares/azure_api_auth";

import { OrganizationModel } from "../models/organization";

import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "../utils/response";

// simle request middleware that passes the request object for debug purposes
const ExpressRequestMiddleware: IRequestMiddleware<never, express.Request> =
  (request) => Promise.resolve(right(request));

// type definition of the debug endpoint
type GetDebug = (
  request: express.Request,
  auth: IAzureApiAuthorization,
) => Promise<IResponseSuccessJson<object>>;

const getDebugHandler: GetDebug = (request, auth) => {
  return new Promise((resolve, _) => {
    resolve(ResponseSuccessJson({
      auth,
      body: request.body,
      headers: request.headers,
      params: request.params,
    }));
  });
};

export function GetDebug(organizationModel: OrganizationModel): express.RequestHandler {
  const azureApiMiddleware = AzureApiAuthMiddleware(organizationModel);
  const middlewaresWrap = withRequestMiddlewares(ExpressRequestMiddleware, azureApiMiddleware);
  return wrapRequestHandler(middlewaresWrap(getDebugHandler));
}
