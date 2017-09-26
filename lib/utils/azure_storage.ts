import * as azureStorage from "azure-storage";
import { Option, option } from "ts-option";
import { Either, left, right } from "./either";

// Storage connection string may be process.env.AzureWebJobsStorage;

export type BlobService = azureStorage.BlobService;

export function getBlobService(
  connectionString: string
): azureStorage.BlobService {
  return azureStorage.createBlobService(connectionString);
}

export function getBlobUrl(
  blobService: azureStorage.BlobService,
  containerName: string,
  attachmentName: string
): string {
  return blobService.getUrl(containerName, attachmentName);
}

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
          resolve(left(err));
        }
        resolve(right(option(result)));
      }
    )
  );
}
