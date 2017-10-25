import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  IVersionedModel,
  ModelId
} from "../utils/documentdb_model_versioned";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { FiscalCode, isFiscalCode } from "../api/definitions/FiscalCode";

import { nonEmptyStringToModelId } from "../utils/conversions";
import { NonNegativeNumber } from "../utils/numbers";
import { NonEmptyString } from "../utils/strings";

/**
 * Base interface for Service objects
 */
interface IBaseService {
  // this equals user's subscriptionId
  readonly serviceId: NonEmptyString;
  // the name of the department within the service
  readonly departmentName: NonEmptyString;
  // the name of the service
  readonly serviceName: NonEmptyString;
  // the name of the organization
  readonly organizationName: NonEmptyString;
}

/**
 * Interface needed to interact with
 * retrieved services from database
 */
export interface IService extends IBaseService {
  // list of authorized fiscal codes
  readonly authorizedRecipients?: ReadonlyArray<FiscalCode>;
}

/**
 * Interface for new Service objects
 */
export interface INewService
  extends IService,
    DocumentDb.NewDocument,
    IVersionedModel {
  readonly kind: "INewService";
}

/**
 * Interface for retrieved Service objects
 *
 * Existing Service records have a version number.
 */
export interface IRetrievedService
  extends IService,
    DocumentDb.RetrievedDocument,
    IVersionedModel {
  readonly id: NonEmptyString;
  readonly kind: "IRetrievedService";
}

export interface IAuthorizedService extends IBaseService {
  // list of authorized fiscal codes
  readonly authorizedRecipients?: ReadonlySet<FiscalCode>;
}

export function toAuthorizedService(service: IService): IAuthorizedService {
  return {
    ...service,
    authorizedRecipients: service.authorizedRecipients
      ? new Set(service.authorizedRecipients.filter(isFiscalCode))
      : new Set()
  };
}

export function toService(service: IAuthorizedService): IService {
  return {
    ...service,
    authorizedRecipients: service.authorizedRecipients
      ? Array.from(service.authorizedRecipients).filter(isFiscalCode)
      : []
  };
}

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedService {
  return {
    ...result,
    kind: "IRetrievedService"
  } as IRetrievedService;
}

function getModelId(o: IService): ModelId {
  return nonEmptyStringToModelId(o.serviceId);
}

function updateModelId(
  o: IService,
  id: string,
  version: NonNegativeNumber
): INewService {
  const newService: INewService = {
    ...o,
    id,
    kind: "INewService",
    version
  };
  return newService;
}

function toBaseType(o: IRetrievedService): IService {
  return {
    departmentName: o.departmentName,
    organizationName: o.organizationName,
    serviceId: o.serviceId,
    serviceName: o.serviceName
  };
}

/**
 * A model for handling Services
 */
export class ServiceModel extends DocumentDbModelVersioned<
  IService,
  INewService,
  IRetrievedService
> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUri: DocumentDbUtils.IDocumentDbCollectionUri;

  /**
   * Creates a new Service model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super();
    // tslint:disable-next-line:no-object-mutation
    this.toRetrieved = toRetrieved;
    // tslint:disable-next-line:no-object-mutation
    this.getModelId = getModelId;
    // tslint:disable-next-line:no-object-mutation
    this.versionateModel = updateModelId;
    // tslint:disable-next-line:no-object-mutation
    this.toBaseType = toBaseType;
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUri = collectionUrl;
  }

  public findOneByServiceId(
    serviceId: NonEmptyString
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedService>>> {
    return super.findLastVersionByModelId("services", "serviceId", serviceId);
  }
}
