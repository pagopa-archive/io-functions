// tslint:disable:no-any

import { none, some } from "ts-option";

import { right } from "../../either";

import { AzureUserAttributesMiddleware } from "../azure_user_attributes";

describe("AzureUserAttributesMiddleware", () => {
  it("should ignore invalid yaml", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => "xyz")
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    return middleware(mockRequest as any).then(result => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
      expect(result.isRight).toBeTruthy();
    });
  });

  it("should ignore the user organization from the custom attributes if it does not exist", async () => {
    const orgModel = {
      findByOrganizationId: jest.fn(() => Promise.resolve(right(none)))
    };

    const mockRequest = {
      header: jest.fn(() =>
        encodeURI(
          [
            "# example custom attributes in yaml",
            "---",
            "organizationId: agid",
            "dummy: dummy",
            ""
          ].join("\n")
        )
      )
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);

    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.organization).toBeUndefined();
    }
  });

  it("should fetch and return the user organization from the custom attributes", async () => {
    const mockOrg = {
      name: "AGID"
    };

    const orgModel = {
      findByOrganizationId: jest.fn(() =>
        Promise.resolve(right(some(mockOrg as any)))
      )
    };

    const mockRequest = {
      header: jest.fn(() =>
        encodeURI(
          [
            "# example custom attributes in yaml",
            "---",
            "organizationId: agid",
            "dummy: dummy",
            ""
          ].join("\n")
        )
      )
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isRight);
    if (result.isRight) {
      expect(result.right.organization).toEqual(mockOrg);
    }
  });

  it("should fail in case of error when fetching the user organization", async () => {
    const orgModel = {
      findByOrganizationId: jest.fn(() => Promise.reject("error"))
    };

    const mockRequest = {
      header: jest.fn(() => "organizationId: agid")
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });
});
