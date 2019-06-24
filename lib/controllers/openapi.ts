/**
 * Handler for publishing the API specs as JSON
 * See https://zalando.github.io/restful-api-guidelines/index.html#192
 */

import * as express from "express";

import { wrapRequestHandler } from "io-functions-commons/dist/src/utils/request_middleware";

import { ResponseSuccessJson } from "italia-ts-commons/lib/responses";

export function GetOpenapi(apiSpecs: object): express.RequestHandler {
  return wrapRequestHandler(() =>
    Promise.resolve(ResponseSuccessJson(apiSpecs))
  );
}
