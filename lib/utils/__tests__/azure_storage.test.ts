import { isRight } from "fp-ts/lib/Either";
import { getBlobAsText, upsertBlobFromText } from "../azure_storage";

jest.mock("azure-storage");
import * as azureStorage from "azure-storage";

const aBlobResult: azureStorage.BlobService.BlobResult = {
  blobType: "",
  container: "",
  contentLength: "",
  etag: "",
  lastModified: "",
  name: "",
  requestId: ""
};
const aConnectionString = "credentials=credentials";
const aContainerName = "container-name";
const anAttachmentName = "attachment-name";
const aRandomText = "random-text";

const aBlobService = new azureStorage.BlobService(aConnectionString);

describe("upsertBlobFromText", () => {
  it("should call blobService.createBlockBlobFromText once", async () => {
    const spy = jest
      .spyOn(aBlobService, "createBlockBlobFromText")
      .mockImplementation((_, __, ___, cb) => {
        cb(undefined, aBlobResult);
      });
    const result = await upsertBlobFromText(
      aBlobService,
      aContainerName,
      anAttachmentName,
      aRandomText
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      aContainerName,
      anAttachmentName,
      aRandomText,
      expect.any(Function)
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.toUndefined()).toEqual(aBlobResult);
    }
    spy.mockReset();
  });
});

describe("upsertBlobFromObject", () => {
  it("should call blobService.createBlockBlobFromText once", async () => {
    const spy = jest
      .spyOn(aBlobService, "createBlockBlobFromText")
      .mockImplementation((_, __, ___, cb) => {
        cb(undefined, aBlobResult);
      });
    const result = await upsertBlobFromText(
      aBlobService,
      aContainerName,
      anAttachmentName,
      aRandomText
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      aContainerName,
      anAttachmentName,
      aRandomText,
      expect.any(Function)
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.toUndefined()).toEqual(aBlobResult);
    }
    spy.mockReset();
  });

  describe("getBlobAsText", () => {
    it("should call blobService.getBlobToText once", async () => {
      const spy = jest
        .spyOn(aBlobService, "getBlobToText")
        .mockImplementation((_, __, cb) => {
          cb(undefined, aRandomText);
        });
      const result = await getBlobAsText(
        aBlobService,
        aContainerName,
        anAttachmentName
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        aContainerName,
        anAttachmentName,
        expect.any(Function)
      );
      expect(isRight(result)).toBeTruthy();
      if (isRight(result)) {
        expect(result.value.toUndefined()).toEqual(aRandomText);
      }
      spy.mockReset();
    });
  });
});
