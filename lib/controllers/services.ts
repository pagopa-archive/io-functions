/*
 * Implements the Public API handlers for the Services resource.
 */

import * as express from "express";
import * as t from "io-ts";

import {
  ClientIp,
  ClientIpMiddleware
} from "../utils/middlewares/client_ip_middleware";

import { RetrievedService, ServiceModel } from "../models/service";

import { ServicePublic as ApiService } from "../api/definitions/ServicePublic";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";

import { RequiredParamMiddleware } from "../utils/middlewares/required_param";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "io-ts-commons/lib/responses";
import {
  IResponseErrorQuery,
  IResponseSuccessJsonIterator,
  ResponseErrorQuery,
  ResponseJsonIterator
} from "../utils/response";

import { NonEmptyString } from "io-ts-commons/lib/strings";

import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../utils/middlewares/azure_user_attributes";

import { FiscalCode } from "../api/definitions/FiscalCode";
import { ServiceId } from "../api/definitions/ServiceId";
import { SenderServiceModel } from "../models/sender_service";
import { mapResultIterator } from "../utils/documentdb";

import { BlobService } from "azure-storage";

import { StrMap } from "fp-ts/lib/StrMap";
import { ServiceTuple } from "../api/definitions/ServiceTuple";
import {
  toServicesTuple,
  VISIBLE_SERVICE_BLOB_ID,
  VISIBLE_SERVICE_CONTAINER,
  VisibleService
} from "../models/visible_service";
import { getBlobAsObject } from "../utils/azure_storage";
import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

type IGetServiceHandlerRet =
  | IResponseSuccessJson<ApiService>
  | IResponseErrorNotFound
  | IResponseErrorQuery;

type IGetServiceHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes,
  serviceId: ServiceId
) => Promise<IGetServiceHandlerRet>;

type IGetSenderServicesHandlerRet =
  | IResponseSuccessJsonIterator<ServiceTuple>
  | IResponseErrorQuery;

type IGetSenderServicesHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes,
  fiscalCode: FiscalCode
) => Promise<IGetSenderServicesHandlerRet>;

type IGetVisibleServicesHandlerRet =
  | IResponseSuccessJson<{
      readonly items: ReadonlyArray<ServiceTuple>;
      readonly page_size: number;
    }>
  | IResponseErrorInternal;

type IGetVisibleServicesHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes
) => Promise<IGetVisibleServicesHandlerRet>;

/**
 * Converts a retrieved service to a service that can be shared via API
 */
function retrievedServiceToPublic(
  retrievedService: RetrievedService
): ApiService {
  return {
    department_name: retrievedService.departmentName,
    organization_fiscal_code: retrievedService.organizationFiscalCode,
    organization_name: retrievedService.organizationName,
    service_id: retrievedService.serviceId,
    service_name: retrievedService.serviceName,
    version: retrievedService.version
  };
}

/**
 * Extracts the serviceId value from the URL path parameter.
 */
const requiredServiceIdMiddleware = RequiredParamMiddleware(
  "serviceid",
  NonEmptyString
);

export function GetServiceHandler(
  serviceModel: ServiceModel
): IGetServiceHandler {
  return async (_, __, ___, serviceId) =>
    (await serviceModel.findOneByServiceId(serviceId)).fold<
      IGetServiceHandlerRet
    >(
      error => ResponseErrorQuery("Error while retrieving the service", error),
      maybeService =>
        maybeService.foldL<
          IResponseErrorNotFound | IResponseSuccessJson<ApiService>
        >(
          () =>
            ResponseErrorNotFound(
              "Service not found",
              "The service you requested was not found in the system."
            ),
          service => ResponseSuccessJson(retrievedServiceToPublic(service))
        )
    );
}

/**
 * Wraps a GetService handler inside an Express request handler.
 */
export function GetService(serviceModel: ServiceModel): express.RequestHandler {
  const handler = GetServiceHandler(serviceModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiPublicServiceRead])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    requiredServiceIdMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __) => ipTuple(c, u))
    )
  );
}

///////////////////////////////////////

/**
 * Returns the serviceId for all the Services that have sent
 * at least one notification to the recipient with the provided fiscalCode.
 */
export function GetServicesByRecipientHandler(
  senderServiceModel: SenderServiceModel
): IGetSenderServicesHandler {
  return async (_, __, ___, fiscalCode) => {
    const retrievedServicesIterator = senderServiceModel.findSenderServicesForRecipient(
      fiscalCode
    );
    const senderServicesIterator = mapResultIterator(
      retrievedServicesIterator,
      service => ({
        service_id: service.serviceId,
        version: service.version
      })
    );
    return ResponseJsonIterator(senderServicesIterator);
  };
}

/**
 * Wraps a GetSenderServices handler inside an Express request handler.
 */
export function GetServicesByRecipient(
  serviceModel: ServiceModel,
  senderServiceModel: SenderServiceModel
): express.RequestHandler {
  const handler = GetServicesByRecipientHandler(senderServiceModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceByRecipientQuery])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    RequiredParamMiddleware("fiscalcode", FiscalCode)
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __) => ipTuple(c, u))
    )
  );
}

///////////////////////////////////////

/**
 * Returns all the visible services (is_visible = true).
 */
export function GetVisibleServicesHandler(
  blobService: BlobService
): IGetVisibleServicesHandler {
  return async (_, __, ___) => {
    const errorOrVisibleServicesJson = await getBlobAsObject(
      t.dictionary(ServiceId, VisibleService),
      blobService,
      VISIBLE_SERVICE_CONTAINER,
      VISIBLE_SERVICE_BLOB_ID
    );
    return errorOrVisibleServicesJson.fold<IGetVisibleServicesHandlerRet>(
      error =>
        ResponseErrorInternal(
          `Error getting visible services list: ${error.message}`
        ),
      visibleServicesJson => {
        const servicesTuples = toServicesTuple(new StrMap(visibleServicesJson));
        return ResponseSuccessJson({
          items: servicesTuples,
          page_size: servicesTuples.length
        });
      }
    );
  };
}

/**
 * Wraps a GetVisibleServices handler inside an Express request handler.
 */
export function GetVisibleServices(
  serviceModel: ServiceModel,
  blobService: BlobService
): express.RequestHandler {
  const handler = GetVisibleServicesHandler(blobService);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiPublicServiceList])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u) => ipTuple(c, u))
    )
  );
}
