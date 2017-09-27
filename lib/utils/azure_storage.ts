/**
 * Utility functions to interact with an Azure Blob Storage.
 */
import * as azureStorage from "azure-storage";
import { Option, option } from "ts-option";
import { Either, left, right } from "./either";

/**
 * Create a new blob (media). 
 * Assumes that the container <containerName> already exists.
 * 
 * @param blobName 
 * @param text 
 */
export function upsertBlobFromText(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  text: string | Buffer
): Promise<Either<Error, Option<azureStorage.BlobService.BlobResult>>> {
  return new Promise((resolve, _) =>
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      text,
      (err, result, __) => {
        if (err) {
          return resolve(left(err));
        } else {
          return resolve(right(option(result)));
        }
      }
    )
  );
}
