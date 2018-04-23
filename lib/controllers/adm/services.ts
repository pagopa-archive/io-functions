/*
 * Implements the API handlers for the Services resource.
 */
import * as express from "express";

import {
  ClientIp,
  ClientIpMiddleware
} from "../../utils/middlewares/client_ip_middleware";

import {
  RetrievedService,
  Service,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../../models/service";

import { CIDR } from "../../api/definitions/CIDR";
import { FiscalCode } from "../../api/definitions/FiscalCode";
import { Service as ApiService } from "../../api/definitions/Service";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";

import { RequiredParamMiddleware } from "../../utils/middlewares/required_param";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "../../utils/request_middleware";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorQuery,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "../../utils/response";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../../utils/middlewares/azure_user_attributes";

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../../utils/source_ip_check";

type ICreateServiceHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes,
  service: ApiService
) => Promise<IResponseSuccessJson<ApiService> | IResponseErrorQuery>;

type IGetServiceHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes,
  serviceId: NonEmptyString
) => Promise<
  | IResponseSuccessJson<ApiService>
  | IResponseErrorNotFound
  | IResponseErrorQuery
>;

type IUpdateServiceHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes,
  serviceId: NonEmptyString,
  service: ApiService
) => Promise<
  | IResponseSuccessJson<ApiService>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorInternal
  | IResponseErrorNotFound
>;

/**
 * Converts a retrieved service to a service that can be shared via API
 */
function retrievedServiceToPublic(
  retrievedService: RetrievedService
): ApiService {
  return {
    authorized_cidrs: Array.from(retrievedService.authorizedCIDRs).filter(
      CIDR.is
    ),
    authorized_recipients: Array.from(
      retrievedService.authorizedRecipients
    ).filter(FiscalCode.is),
    department_name: retrievedService.departmentName,
    id: retrievedService.id,
    organization_name: retrievedService.organizationName,
    service_id: retrievedService.serviceId,
    service_name: retrievedService.serviceName,
    version: retrievedService.version
  };
}

/**
 * Converts an API Service to an internal Service model
 */
function servicePayloadToService(service: ApiService): Service {
  return {
    authorizedCIDRs: toAuthorizedCIDRs(service.authorized_cidrs),
    authorizedRecipients: toAuthorizedRecipients(service.authorized_recipients),
    departmentName: service.department_name,
    organizationName: service.organization_name,
    serviceId: service.service_id,
    serviceName: service.service_name
  };
}

/**
 * A middleware that extracts a Service payload from a request.
 */
export const ServicePayloadMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  ApiService
> = request =>
  new Promise(resolve => {
    const validation = ApiService.decode(request.body);
    const result = validation.mapLeft(
      ResponseErrorFromValidationErrors(ApiService)
    );
    resolve(result);
  });

export function UpdateServiceHandler(
  serviceModel: ServiceModel
): IUpdateServiceHandler {
  return async (_, __, ___, serviceId, serviceModelPayload) => {
    if (serviceModelPayload.service_id !== serviceId) {
      return ResponseErrorValidation(
        "Error validating payload",
        "Value of `service_id` in the request body must match " +
          "the value of `service_id` path parameter"
      );
    }
    const errorOrMaybeService = await serviceModel.findOneByServiceId(
      serviceId
    );
    if (isLeft(errorOrMaybeService)) {
      return ResponseErrorQuery(
        "Error trying to retrieve existing service",
        errorOrMaybeService.value
      );
    }

    const maybeService = errorOrMaybeService.value;
    if (isNone(maybeService)) {
      return ResponseErrorNotFound(
        "Error",
        "Could not find a service with the provided serviceId"
      );
    }

    const existingService = maybeService.value;

    const errorOrMaybeUpdatedService = await serviceModel.update(
      existingService.id,
      existingService.serviceId,
      currentService => {
        return {
          ...currentService,
          ...servicePayloadToService(serviceModelPayload),
          serviceId
        };
      }
    );
    if (isLeft(errorOrMaybeUpdatedService)) {
      return ResponseErrorQuery(
        "Error while updating the existing service",
        errorOrMaybeUpdatedService.value
      );
    }

    const maybeUpdatedService = errorOrMaybeUpdatedService.value;
    if (isNone(maybeUpdatedService)) {
      return ResponseErrorInternal("Error while updating the existing service");
    }

    return ResponseSuccessJson(
      retrievedServiceToPublic(maybeUpdatedService.value)
    );
  };
}

/**
 * Extracts the serviceId value from the URL path parameter.
 */
const requiredServiceIdMiddleware = RequiredParamMiddleware(
  "serviceid",
  NonEmptyString
);

export function CreateServiceHandler(
  serviceModel: ServiceModel
): ICreateServiceHandler {
  return async (_, __, ___, serviceModelPayload) => {
    const service = servicePayloadToService(serviceModelPayload);
    const errorOrService = await serviceModel.create(
      service,
      service.serviceId
    );
    if (isRight(errorOrService)) {
      return ResponseSuccessJson(
        retrievedServiceToPublic(errorOrService.value)
      );
    } else {
      return ResponseErrorQuery("Error", errorOrService.value);
    }
  };
}

export function GetServiceHandler(
  serviceModel: ServiceModel
): IGetServiceHandler {
  return async (_, __, ___, serviceId) => {
    const errorOrMaybeService = await serviceModel.findOneByServiceId(
      serviceId
    );
    if (isRight(errorOrMaybeService)) {
      const maybeService = errorOrMaybeService.value;
      if (isNone(maybeService)) {
        return ResponseErrorNotFound(
          "Service not found",
          "The service you requested was not found in the system."
        );
      } else {
        return ResponseSuccessJson(
          retrievedServiceToPublic(maybeService.value)
        );
      }
    } else {
      return ResponseErrorQuery(
        "Error while retrieving the service",
        errorOrMaybeService.value
      );
    }
  };
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
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceRead])),
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

/**
 * Wraps a CreateService handler inside an Express request handler.
 */
export function CreateService(
  serviceModel: ServiceModel
): express.RequestHandler {
  const handler = CreateServiceHandler(serviceModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceWrite])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    ServicePayloadMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __) => ipTuple(c, u))
    )
  );
}

/**
 * Wraps an UpdateService handler inside an Express request handler.
 */
export function UpdateService(
  serviceModel: ServiceModel
): express.RequestHandler {
  const handler = UpdateServiceHandler(serviceModel);
  const azureUserAttributesMiddleware = AzureUserAttributesMiddleware(
    serviceModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceWrite])),
    ClientIpMiddleware,
    azureUserAttributesMiddleware,
    requiredServiceIdMiddleware,
    ServicePayloadMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __, ___) => ipTuple(c, u))
    )
  );
}
