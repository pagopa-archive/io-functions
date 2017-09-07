/**
 * Handler for providing information about the running system
 */

import * as express from "express";

import { withRequestMiddlewares, wrapRequestHandler } from "../utils/request_middleware";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup,
} from "../utils/middlewares/azure_api_auth";

import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "../utils/response";

interface IResponseInfo {
  readonly status: "OK";
}

// type definition of the info endpoint
type GetInfo = (
  auth: IAzureApiAuthorization,
) => Promise<IResponseSuccessJson<IResponseInfo>>;

const getInfoHandler: GetInfo = (_) => {
  return new Promise((resolve) => {
    const info: IResponseInfo = {
      status: "OK",
    };
    resolve(ResponseSuccessJson(info));
  });
};

// TODO: give access to a more specific group, see #150738263
export function GetInfo(): express.RequestHandler {
  const azureApiMiddleware = AzureApiAuthMiddleware(new Set([
    UserGroup.ApiInfoRead,
  ]));
  const middlewaresWrap = withRequestMiddlewares(
    azureApiMiddleware,
  );
  return wrapRequestHandler(middlewaresWrap(getInfoHandler));
}
