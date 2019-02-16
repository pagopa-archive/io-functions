/**
 * A SenderService collection stores all the services that have
 * contacted a specific user (fiscalCode) using the notification APIs
 */
import { pick } from "io-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as t from "io-ts";

import { tag } from "io-ts-commons/lib/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { FiscalCode } from "../api/definitions/FiscalCode";

import { DateFromString } from "io-ts-commons/lib/dates";
import { NonNegativeNumber } from "io-ts-commons/lib/numbers";
import { NonEmptyString } from "io-ts-commons/lib/strings";
import { ServiceId } from "../api/definitions/ServiceId";

// partition the CosmosDB collection by this field
export const SENDER_SERVICE_MODEL_PK_FIELD = "recipientFiscalCode";

export const SenderService = t.interface({
  lastNotificationAt: DateFromString,
  // fiscal code of the user that has received at least
  // one message from the service identified by the serviceId
  [SENDER_SERVICE_MODEL_PK_FIELD]: FiscalCode,
  serviceId: ServiceId,
  version: NonNegativeNumber
});
export type SenderService = t.TypeOf<typeof SenderService>;

export const SENDER_SERVICE_COLLECTION_NAME = "sender-services";

/**
 * Interface for new SenderService objects
 */
interface INewSenderServiceTag {
  readonly kind: "INewSenderService";
}

export const NewSenderService = tag<INewSenderServiceTag>()(
  t.intersection([SenderService, DocumentDbUtils.NewDocument])
);

export type NewSenderService = t.TypeOf<typeof NewSenderService>;

/**
 * Interface for retrieved SenderService objects
 */

interface IRetrievedSenderServiceTag {
  readonly kind: "IRetrievedSenderService";
}

export const RetrievedSenderService = tag<IRetrievedSenderServiceTag>()(
  t.intersection([SenderService, DocumentDbUtils.RetrievedDocument])
);

export type RetrievedSenderService = t.TypeOf<typeof RetrievedSenderService>;

/* istanbul ignore next */
function toBaseType(o: RetrievedSenderService): SenderService {
  return pick(
    [
      "lastNotificationAt",
      SENDER_SERVICE_MODEL_PK_FIELD,
      "serviceId",
      "version"
    ],
    o
  );
}

/* istanbul ignore next */
function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedSenderService {
  return {
    ...result,
    kind: "IRetrievedSenderService"
  } as RetrievedSenderService;
}

/* istanbul ignore next */
export function makeSenderServiceId(
  recipientFiscalCode: FiscalCode,
  serviceId: ServiceId
): NonEmptyString {
  return NonEmptyString.decode(
    `${recipientFiscalCode}:${serviceId}`
  ).getOrElseL(() => {
    throw new Error("Invalid sender service id");
  });
}

export function newSenderService(
  fiscalCode: FiscalCode,
  senderServiceId: ServiceId,
  version: NonNegativeNumber
): NewSenderService {
  return {
    id: makeSenderServiceId(fiscalCode, senderServiceId),
    kind: "INewSenderService",
    lastNotificationAt: new Date(),
    recipientFiscalCode: fiscalCode,
    serviceId: senderServiceId,
    version
  };
}

/**
 * A model for handling SenderServices
 */
export class SenderServiceModel extends DocumentDbModel<
  SenderService,
  NewSenderService,
  RetrievedSenderService
> {
  /**
   * Creates a new SenderService model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(dbClient, collectionUrl, toBaseType, toRetrieved);
  }

  /**
   * Returns the SenderServices associated to the provided fiscalCode.
   *
   * @param recipient The fiscalCode of the recipient user
   */
  /* istanbul ignore next */
  public findSenderServicesForRecipient(
    recipient: FiscalCode
  ): DocumentDbUtils.IResultIterator<RetrievedSenderService> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@fiscalCode",
            value: recipient
          }
        ],
        query: `SELECT * FROM n WHERE n.${SENDER_SERVICE_MODEL_PK_FIELD} = @fiscalCode`
      },
      recipient
    );
  }
}
