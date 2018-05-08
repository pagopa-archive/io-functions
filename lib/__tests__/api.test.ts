import * as SwaggerParser from "swagger-parser";

describe("API specs", () => {
  it("should validate admin api", async () => {
    const specFilePath = `${__dirname}/../../api/admin_api.yaml`;
    const api = await SwaggerParser.bundle(specFilePath);
    expect(api).toBeDefined();
  });
  it("should validate public api", async () => {
    const specFilePath = `${__dirname}/../../api/public_api_v1.yaml`;
    const api = await SwaggerParser.bundle(specFilePath);
    expect(api).toBeDefined();
  });
});
