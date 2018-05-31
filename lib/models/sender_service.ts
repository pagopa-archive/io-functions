/**
 * A SenderService collection stores all the services that have
 * contacted a specific user (fiscalCode) using the notification APIs
 */
import { pick } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as t from "io-ts";

import { tag } from "italia-ts-commons/lib/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { FiscalCode } from "../api/definitions/FiscalCode";

import { DateFromString } from "italia-ts-commons/lib/dates";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ServiceId } from "../api/definitions/ServiceId";

export const SENDER_SERVICE_COLLECTION_NAME = "sender-services";
export const SENDER_SERVICE_MODEL_ID_FIELD = "fiscalCode";
export const SENDER_SERVICE_MODEL_PK_FIELD = "fiscalCode";

export const SenderService = t.interface({
  lastNotificationAt: DateFromString,
  recipient: FiscalCode,
  serviceId: ServiceId
});
export type SenderService = t.TypeOf<typeof SenderService>;

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
  return pick(["lastNotificationAt", "recipient", "serviceId"], o);
}

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedSenderService {
  return {
    ...result,
    kind: "IRetrievedSenderService"
  } as RetrievedSenderService;
}

export function makeSenderServiceId(
  fiscalCode: FiscalCode,
  serviceId: ServiceId
): NonEmptyString {
  return NonEmptyString.decode(`${fiscalCode}:${serviceId}`).getOrElseL(() => {
    throw new Error("Invalid sender service id");
  });
}

export function newSenderService(
  fiscalCode: FiscalCode,
  senderServiceId: ServiceId
): NewSenderService {
  return {
    id: makeSenderServiceId(fiscalCode, senderServiceId),
    kind: "INewSenderService",
    lastNotificationAt: new Date(),
    recipient: fiscalCode,
    serviceId: senderServiceId
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
    return DocumentDbUtils.queryDocuments(this.dbClient, this.collectionUri, {
      parameters: [
        {
          name: "@fiscalCode",
          value: recipient
        }
      ],
      query: "SELECT * FROM n WHERE n.recipient = @fiscalCode"
    });
  }
}
