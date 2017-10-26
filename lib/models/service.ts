import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  IVersionedModel,
  ModelId
} from "../utils/documentdb_model_versioned";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { Set } from "json-set-map";

import { FiscalCode, isFiscalCode } from "../api/definitions/FiscalCode";

import { nonEmptyStringToModelId } from "../utils/conversions";
import { NonNegativeNumber } from "../utils/numbers";
import { NonEmptyString, toNonEmptyString } from "../utils/strings";

/**
 * Base interface for Service objects
 */
export interface IService {
  // this equals user's subscriptionId
  readonly serviceId: NonEmptyString;
  // the name of the department within the service
  readonly departmentName: NonEmptyString;
  // the name of the service
  readonly serviceName: NonEmptyString;
  // the name of the organization
  readonly organizationName: NonEmptyString;
  // list of authorized fiscal codes
  readonly authorizedRecipients: ReadonlySet<FiscalCode>;
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

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedService {
  // We have to accept both Arrays (coming from find() deserialized object)
  // and Set() (IService instance passed to create() or update())
  return {
    ...result,
    authorizedRecipients:
      result.authorizedRecipients &&
      result.authorizedRecipients instanceof Array
        ? new Set(result.authorizedRecipients.filter(isFiscalCode))
        : result.authorizedRecipients instanceof Set
          ? result.authorizedRecipients
          : new Set(),
    departmentName: result.departmentName,
    id: toNonEmptyString(result.id).get,
    kind: "IRetrievedService",
    organizationName: result.organizationName,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    version: result.version
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
    authorizedRecipients: new Set(o.authorizedRecipients),
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
