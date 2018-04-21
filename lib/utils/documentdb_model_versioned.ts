import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "./documentdb";
import { DocumentDbModel } from "./documentdb_model";

import * as t from "io-ts";

import { isNone, none, Option, some } from "fp-ts/lib/Option";

import { tag } from "italia-ts-commons/dist/lib/types";

import { NonNegativeNumber } from "italia-ts-commons/dist/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/dist/lib/strings";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";

interface IModelIdTag {
  readonly kind: "IModelIdTag";
}

export const ModelId = tag<IModelIdTag>()(t.string);

export type ModelId = t.TypeOf<typeof ModelId>;

/**
 * A VersionedModel should track the version of the model
 */
export const VersionedModel = t.interface({
  version: NonNegativeNumber
});

export type VersionedModel = t.TypeOf<typeof VersionedModel>;

/**
 * Returns a string with a composite id that has the format:
 * MODEL_ID-VERSION
 *
 * MODEL_ID is the base model ID
 * VERSION is the zero-padded version of the model
 *
 * @param modelId The base model ID
 * @param version The version of the model
 */
export function generateVersionedModelId(
  modelId: ModelId,
  version: NonNegativeNumber
): NonEmptyString {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
  return `${modelId}-${paddedVersion}` as NonEmptyString;
}

export abstract class DocumentDbModelVersioned<
  T,
  TN extends T & DocumentDb.NewDocument & VersionedModel,
  TR extends T & DocumentDb.RetrievedDocument & VersionedModel
> extends DocumentDbModel<T, TN, TR> {
  constructor(
    // instance of a DocumentDB client
    dbClient: DocumentDb.DocumentClient,
    // the URI of the collection associated to this model
    collectionUri: DocumentDbUtils.IDocumentDbCollectionUri,
    // An helper that converts a retrieved document to the base document type
    toBaseType: (o: TR) => T,
    // An helper that converts the result of a query (a plain DocumentDB document
    // to the retrieved type).
    toRetrieved: (result: DocumentDb.RetrievedDocument) => TR,
    protected readonly getModelId: (o: T) => ModelId,
    protected readonly versionateModel: (
      o: T,
      id: NonEmptyString,
      version: NonNegativeNumber
    ) => TN
  ) {
    super(dbClient, collectionUri, toBaseType, toRetrieved);
  }

  public async create(
    document: T,
    partitionKey: string
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // the first version of a profile is 0
    const initialVersion = 0 as NonNegativeNumber;
    // the ID of each document version is composed of the document ID and its version
    // this makes it possible to detect conflicting updates (concurrent creation of
    // profiles with the same profile ID and version)
    const modelId = this.getModelId(document);
    const versionedModelId = generateVersionedModelId(modelId, initialVersion);

    // spread over generic type doesn't work yet, waiting for
    // https://github.com/Microsoft/TypeScript/pull/13288
    // const newDocument = {
    //   ...document,
    //   id: versionedModelId,
    //   version: initialVersion,
    // };

    const newDocument = this.versionateModel(
      document,
      versionedModelId,
      initialVersion
    );

    return super.create(newDocument, partitionKey);
  }

  public async upsert<V, K extends keyof TR>(
    document: T,
    modelIdField: K,
    modelIdValue: V,
    partitionKeyField: string,
    partitionKeyValue: string
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    const errorOrMaybeCurrent = await this.findLastVersionByModelId(
      modelIdField,
      modelIdValue,
      partitionKeyField,
      partitionKeyValue
    );

    if (isLeft(errorOrMaybeCurrent)) {
      return left(errorOrMaybeCurrent.value);
    }

    const maybeCurrent = errorOrMaybeCurrent.value;

    const nextVersion = maybeCurrent
      .map(
        currentRetrievedDocument =>
          (Number(currentRetrievedDocument.version) + 1) as NonNegativeNumber
      )
      .getOrElse(0 as NonNegativeNumber);

    const modelId = this.getModelId(document);
    const versionedModelId = generateVersionedModelId(modelId, nextVersion);

    const newDocument = this.versionateModel(
      document,
      versionedModelId,
      nextVersion
    );

    return super.create(newDocument, partitionKeyValue);
  }

  public async update(
    objectId: string,
    partitionKey: string,
    f: (current: T) => T
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    // fetch the document
    const errorOrMaybeCurrent = await this.find(objectId, partitionKey);
    if (isLeft(errorOrMaybeCurrent)) {
      // if the query returned an error, forward it
      return errorOrMaybeCurrent;
    }

    const maybeCurrent = errorOrMaybeCurrent.value;

    if (isNone(maybeCurrent)) {
      return right(maybeCurrent);
    }

    const currentRetrievedDocument = maybeCurrent.value;
    const currentObject = this.toBaseType(currentRetrievedDocument);

    const updatedObject = f(currentObject);

    const modelId = this.getModelId(updatedObject);
    const nextVersion = (Number(currentRetrievedDocument.version) +
      1) as NonNegativeNumber;
    const versionedModelId = generateVersionedModelId(modelId, nextVersion);

    const newDocument = this.versionateModel(
      updatedObject,
      versionedModelId,
      nextVersion
    );

    const createdDocument = await super.create(newDocument, partitionKey);
    return createdDocument.map(some);
  }

  /**
   *  Find the last version of a document.
   *
   *  Pass the partitionKey field / values if it differs from the modelId
   *  to avoid multi-partition queries.
   */
  protected async findLastVersionByModelId<
    V,
    K1 extends keyof TR,
    K2 extends keyof TR
  >(
    modelIdField: K1,
    modelIdValue: V,
    partitionKeyField?: K2,
    partitionKeyValue?: string
  ): Promise<Either<DocumentDb.QueryError, Option<TR>>> {
    const errorOrMaybeDocument = await DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@modelId",
            value: modelIdValue
          },
          {
            name: "@partitionKey",
            value: partitionKeyValue
          }
        ],
        // do not use ${collectionName} here as it may contain special characters
        query: `SELECT TOP 1 * FROM m WHERE (m.${modelIdField} = @modelId ${
          partitionKeyField ? `AND m.${partitionKeyField} = @partitionKey` : ``
        }) ORDER BY m.version DESC`
      }
    );

    if (
      isLeft(errorOrMaybeDocument) &&
      errorOrMaybeDocument.value.code === 404
    ) {
      // if the error is 404 (Not Found), we return an empty value
      return right(none);
    }

    return errorOrMaybeDocument.map(maybeDocument =>
      maybeDocument.map(this.toRetrieved)
    );
  }
}
