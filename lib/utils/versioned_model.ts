/*
 * Common utilities for implementing versioned models.
 */

import { NonNegativeNumber } from "./numbers";

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
export function generateVersionedModelId(modelId: string, version: NonNegativeNumber): string {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + version).slice(-paddingLength);
  return `${modelId}-${paddedVersion}`;
}
