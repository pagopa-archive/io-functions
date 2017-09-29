// tslint:disable:no-any

import { none, some } from "ts-option";

import { left, right } from "../../either";

import { AzureUserAttributesMiddleware } from "../azure_user_attributes";

describe("AzureUserAttributesMiddleware", () => {
  it("should fail on invalid yaml", async () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => "xyz")
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail if the user organization does not exist", async () => {
    const orgModel = {
      findByOrganizationId: jest.fn(() => Promise.resolve(right(none)))
    };

    const mockRequest = {
      header: jest.fn(() =>
        encodeURI(
          `---
organizationId: agid
departmentName: IT
serviceName: Test
`
        )
      )
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);

    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
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
          `---
organizationId: agid
departmentName: IT
serviceName: Test
`
        )
      )
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isRight);
    if (result.isRight) {
      const attributes = result.right;
      expect(attributes.organization).toEqual(mockOrg);
      expect(attributes.departmentName).toEqual("IT");
      expect(attributes.serviceName).toEqual("Test");
    }
  });

  it("should fail in case of error when fetching the user organization", async () => {
    const orgModel = {
      findByOrganizationId: jest.fn(() => Promise.resolve(left("error")))
    };

    const mockRequest = {
      header: jest.fn(
        () => `---
organizationId: agid
departmentName: IT
serviceName: Test
`
      )
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorQuery");
    }
  });
});
