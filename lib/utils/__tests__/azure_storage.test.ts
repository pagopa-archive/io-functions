import { upsertBlobFromText } from "../azure_storage";

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
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.get).toEqual(aBlobResult);
    }
    spy.mockReset();
  });
});
