import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  IVersionedModel,
  ModelId
} from "../utils/documentdb_model_versioned";

import { Option } from "ts-option";
import { Either } from "../utils/either";

import { FiscalCode } from "../api/definitions/FiscalCode";

import { NonNegativeNumber } from "../utils/numbers";
import { NonEmptyString } from "../utils/strings";

/**
 * Base interface for Service objects
 */
export interface IService {
  readonly serviceId: ModelId;
  // the name of the department within the service
  readonly departmentName: NonEmptyString;
  // the name of the service
  readonly serviceName: NonEmptyString;
  // the name of the organization
  readonly organizationName: NonEmptyString;
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
  readonly kind: "IRetrievedService";
  readonly serviceId: ModelId; // serviceId should never change
}

function toRetrieved(result: DocumentDb.RetrievedDocument): IRetrievedService {
  return {
    ...result,
    kind: "IRetrievedService"
  } as IRetrievedService;
}

function getModelId(o: IService): ModelId {
  return o.serviceId;
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

  /**
   * Searches for one Service associated to the provided ID
   *
   * @param fiscalCode
   */
  public findByServiceId(
    serviceId: string
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedService>>> {
    return super.findLastVersionByModelId("services", "serviceId", serviceId);
  }

  /**
   * Searches for one Service associated to the provided Subscription Key
   *
   * @param subscriptionKey
   */
  public findBySubscriptionKey(
    subscriptionKey: string
  ): Promise<Either<DocumentDb.QueryError, Option<IRetrievedService>>> {
    const subscriptionKeyParamName = "@subscriptionKey";
    return DocumentDbUtils.queryOneDocument(this.dbClient, this.collectionUri, {
      parameters: [
        {
          name: subscriptionKeyParamName,
          value: subscriptionKey
        }
      ],
      query: `SELECT * FROM "services" m WHERE (m.subscriptionKey = ${subscriptionKeyParamName}) ORDER BY m.version DESC`
    });
  }
}
