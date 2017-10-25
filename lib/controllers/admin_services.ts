/*
 * Implements the API handlers for the Services resource.
 */
import * as express from "express";

import { IRetrievedService, IService, ServiceModel } from "../models/service";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "../utils/middlewares/azure_api_auth";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "../utils/request_middleware";

import { PathParamMiddleware } from "../utils/middlewares/path_param";

import {
  IResponseErrorInternal,
  IResponseErrorQuery,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorQuery,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "../utils/response";

import { left, right } from "../utils/either";
import {
  isNonEmptyString,
  NonEmptyString,
  ObjectIdGenerator,
  ulidGenerator
} from "../utils/strings";

type ICreateServiceHandler = (
  auth: IAzureApiAuthorization,
  service: IService
) => Promise<
  | IResponseSuccessJson<IRetrievedService>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorInternal
>;

type IUpdateServiceHandler = (
  auth: IAzureApiAuthorization,
  serviceId: NonEmptyString,
  service: IRetrievedService
) => Promise<
  | IResponseSuccessJson<IRetrievedService>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorInternal
>;

/**
 * A middleware that extracts a Service payload from a request.
 *
 * TODO: validate the payload against a schema.
 */
const ServicePayloadMiddleware: IRequestMiddleware<
  IResponseErrorValidation,
  IService
> = request => {
  const servicePayload: IService = {
    authorizedRecipients: request.body.authorized_recipients,
    departmentName: request.body.department_name,
    organizationName: request.body.organization_name,
    // request.body.service_id is undefined when the service
    // is going to be created (and not updated)
    // anyways it's overridden in CreateServiceHandler()
    serviceId: request.body.service_id,
    serviceName: request.body.service_name,
    subscriptionId: request.body.subscription_id
  };

  const nonEmptyFields: { readonly [k: string]: string } = {
    department_name: servicePayload.departmentName,
    organization_name: servicePayload.organizationName,
    service_name: servicePayload.serviceName,
    subscription_id: servicePayload.subscriptionId
  };

  const errors = Object.keys(nonEmptyFields)
    .map(k => {
      if (!nonEmptyFields[k] || !isNonEmptyString(nonEmptyFields[k])) {
        return k + " must be a non empty string";
      }
      return undefined;
    })
    .filter(v => v !== undefined);

  if (errors.length > 0) {
    return Promise.resolve(
      left(
        ResponseErrorValidation(
          "Invalid field found in Service payload",
          errors.join(" - ")
        )
      )
    );
  }
  return Promise.resolve(right(servicePayload));
};

export function UpdateServiceHandler(
  serviceModel: ServiceModel
): IUpdateServiceHandler {
  return async (_, serviceId, serviceModelPayload) => {
    const errorOrMaybeService = await serviceModel.findOneByServiceId(
      serviceId
    );
    if (errorOrMaybeService.isLeft) {
      return ResponseErrorQuery(
        "Error trying to retrieve existing service",
        errorOrMaybeService.left
      );
    }

    const maybeService = errorOrMaybeService.right;
    if (maybeService.isEmpty) {
      return ResponseErrorValidation(
        "Error",
        "Could not find a service with the provided serviceId"
      );
    }

    const existingService = maybeService.get;

    const errorOrMaybeUpdatedService = await serviceModel.update(
      existingService.id,
      existingService.serviceId,
      currentService => {
        const updatedService = {
          ...currentService,
          ...serviceModelPayload,
          serviceId
        };
        return updatedService;
      }
    );
    if (errorOrMaybeUpdatedService.isLeft) {
      return ResponseErrorQuery(
        "Error while updating the existing service",
        errorOrMaybeUpdatedService.left
      );
    }

    const maybeUpdatedService = errorOrMaybeUpdatedService.right;
    if (maybeUpdatedService.isEmpty) {
      return ResponseErrorValidation(
        "Error while updating the existing service",
        "Cannot find the updated service"
      );
    }

    return ResponseSuccessJson(maybeUpdatedService.get);
  };
}

export function CreateServiceHandler(
  serviceModel: ServiceModel,
  generateObjectId: ObjectIdGenerator
): ICreateServiceHandler {
  return async (_, serviceModelPayload) => {
    if (serviceModelPayload.serviceId) {
      return ResponseErrorValidation(
        "Error validating payload",
        "service_id must be empty or undefined"
      );
    }
    const serviceId = generateObjectId();
    const errorOrService = await serviceModel.create(
      { ...serviceModelPayload, serviceId },
      serviceId
    );
    if (errorOrService.isRight) {
      return ResponseSuccessJson(errorOrService.right);
    } else {
      return ResponseErrorQuery("Error", errorOrService.left);
    }
  };
}

/**
 * Wraps a CreateService handler inside an Express request handler.
 */
export function CreateService(
  serviceModel: ServiceModel
): express.RequestHandler {
  const handler = CreateServiceHandler(serviceModel, ulidGenerator);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceWrite])),
    ServicePayloadMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 * Wraps an UpdateService handler inside an Express request handler.
 */
export function UpdateService(
  serviceModel: ServiceModel
): express.RequestHandler {
  const handler = UpdateServiceHandler(serviceModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiServiceWrite])),
    PathParamMiddleware("serviceid", isNonEmptyString),
    ServicePayloadMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
