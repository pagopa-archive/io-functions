import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import * as winston from "winston";

import { Context } from "@azure/functions";

import { DocumentClient } from "documentdb";

import { pick } from "italia-ts-commons/lib/types";

import { insert, lookup, remove, StrMap } from "fp-ts/lib/StrMap";

import {
  RetrievedService,
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "io-functions-commons/dist/src/models/service";
import { getRequiredStringEnv } from "./utils/env";

import { isLeft } from "fp-ts/lib/Either";
import { isNone, isSome } from "fp-ts/lib/Option";
import { VisibleService } from "io-functions-commons/dist/src/models/visible_service";

import { configureAzureContextTransport } from "io-functions-commons/dist/src/utils/logging";

interface IOutputBindings {
  readonly visibleServicesBlob: Record<string, VisibleService>;
}

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const servicesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  SERVICE_COLLECTION_NAME
);
const documentClient = new DocumentClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const serviceModel = new ServiceModel(documentClient, servicesCollectionUrl);

function reduceServicesToVisibleServices(
  visibleServicesObj: StrMap<VisibleService>,
  service: RetrievedService
): StrMap<VisibleService> {
  // we use an in-memory object (map)
  // to temporary store visible services
  const maybeVisibleService = lookup(service.serviceId, visibleServicesObj);
  if (
    !service.isVisible &&
    isSome(maybeVisibleService) &&
    service.version > maybeVisibleService.value.version
  ) {
    // if the service is not visible anymore
    // delete it from the visible services list
    return remove(service.serviceId, visibleServicesObj);
  } else if (
    // if the service is visible and we don't have a related
    // cached visible service yet...
    service.isVisible &&
    (isNone(maybeVisibleService) ||
      // ... or if the updated service is visible and the version
      // is greater than the stored version of the cached visible service
      service.version > maybeVisibleService.value.version)
  ) {
    // store the visible service into the object (map)
    return insert(
      service.serviceId,
      pick(
        [
          "departmentName",
          "id",
          "organizationFiscalCode",
          "organizationName",
          "serviceId",
          "serviceName",
          "version"
        ],
        service
      ),
      visibleServicesObj
    );
  }
  return visibleServicesObj;
}

/**
 * A function to cache the list of visible (active) services.
 *
 * Scheduled using a timer trigger, see
 * https://github.com/MicrosoftDocs/azure-docs/blob/master/articles/azure-functions/functions-bindings-timer.md
 */
export async function index(context: Context): Promise<void | IOutputBindings> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);
  try {
    // iterate over the whole services collection and collect visible services
    const servicesCollectionIterator = await serviceModel.getCollectionIterator();
    const servicesIterator = documentDbUtils.reduceResultIterator(
      servicesCollectionIterator,
      reduceServicesToVisibleServices
    );
    const errorOrVisibleServices = await documentDbUtils.iteratorToValue(
      servicesIterator,
      new StrMap<VisibleService>({})
    );
    if (isLeft(errorOrVisibleServices)) {
      winston.error(
        "ComputeVisibleServices|Error computing visible services: %s",
        errorOrVisibleServices.value
      );
      return;
    }

    const visibleServices = errorOrVisibleServices.value;
    winston.debug(
      "ComputeVisibleServices|Visible services: %s",
      JSON.stringify(visibleServices.value)
    );

    // write to blob storage using output bindings
    return {
      visibleServicesBlob: visibleServices.value
    };
  } catch (e) {
    winston.error("ComputeVisibleServices error: %s", JSON.stringify(e));
    return;
  }
}
