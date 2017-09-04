import * as DocumentDb from "documentdb";
import { DocumentDbModel } from "./documentdb_model";

import { NonNegativeNumber, toNonNegativeNumber } from "./numbers";

import { Either } from "./either";

interface IModelIdTag {
  readonly kind: "IModelIdTag";
}

export type ModelId = string & IModelIdTag;

/**
 * Type guard for numbers that are non-negative.
 */
export function isModelId(s: string): s is ModelId {
  return typeof s === "string" && s.length > 0;
}

/**
 * A VersionedModel should track the version of the model
 */
export interface IVersionedModel {
  readonly version: NonNegativeNumber;
}

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
export function generateVersionedModelId(modelId: ModelId, version: NonNegativeNumber): string {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + version).slice(-paddingLength);
  return `${modelId}-${paddedVersion}`;
}

export abstract class DocumentDbModelVersioned<
  T,
  TN extends T & IVersionedModel & DocumentDb.NewDocument,
  TR extends DocumentDb.RetrievedDocument & IVersionedModel
> extends DocumentDbModel<TN, TR> {

  protected getModelId: (o: T) => ModelId;

  protected versionateModel: (o: T, id: string, version: NonNegativeNumber) => TN;

  protected toBaseType: (o: TR) => T;

  public async create(
    document: T,
    partitionKey: string,
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // the first version of a profile is 0
    const initialVersion = toNonNegativeNumber(0).get;
    // the ID of each profile version is composed of the profile ID and its version
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

    const newDocument = this.versionateModel(document, versionedModelId, initialVersion);

    return super.create(newDocument, partitionKey);
  }

  public async update(
    objectId: string,
    partitionKey: string,
    f: (current: T) => T,
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // fetch the notification
    const errorOrCurrent = await this.find(objectId, partitionKey);
    if (errorOrCurrent.isLeft) {
      // if the query returned an error, forward it
      return errorOrCurrent;
    }

    const currentRetrievedDocument = errorOrCurrent.right;
    const currentObject = this.toBaseType(currentRetrievedDocument);

    const updatedObject = f(currentObject);

    const modelId = this.getModelId(updatedObject);
    const nextVersion = toNonNegativeNumber(currentRetrievedDocument.version + 1).get;
    const versionedModelId = generateVersionedModelId(modelId, nextVersion);

    const newDocument = this.versionateModel(updatedObject, versionedModelId, nextVersion);

    return super.create(newDocument, partitionKey);
  }

}
