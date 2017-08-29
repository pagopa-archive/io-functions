/*
 * Common utilities for implementing versioned models.
 */

import { NonNegativeNumber } from "./numbers";

declare class ModelIdTag {
  private kind: "ModelIdTag";
}

export type ModelId = string & ModelIdTag;

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
