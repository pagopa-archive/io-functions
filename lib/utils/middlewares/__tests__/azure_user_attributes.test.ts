// tslint:disable:no-any

import { none, some } from "ts-option";

import { left, right } from "../../either";

import { AzureUserAttributesMiddleware } from "../azure_user_attributes";

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

describe("AzureUserAttributesMiddleware", () => {
  it("should fail on empty user email", async () => {
    const orgModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid user email", async () => {
    const orgModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": "xyz"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid yaml", async () => {
    const orgModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": "test@example.com",
      "x-user-note": "xyz"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-user-note");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail if the user organization does not exist", async () => {
    const orgModel = {
      findByOrganizationId: jest.fn(() => Promise.resolve(right(none)))
    };

    const headers: IHeaders = {
      "x-user-email": "test@example.com",
      "x-user-note": encodeURI(
        `---
organizationId: agid
departmentName: IT
serviceName: Test
`
      )
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);

    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-user-note");
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

    const headers: IHeaders = {
      "x-user-email": "test@example.com",
      "x-user-note": encodeURI(
        `---
organizationId: agid
departmentName: IT
serviceName: Test
`
      )
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-user-note");
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

    const headers: IHeaders = {
      "x-user-email": "test@example.com",
      "x-user-note": encodeURI(
        `---
organizationId: agid
departmentName: IT
serviceName: Test
`
      )
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesMiddleware(orgModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-user-note");
    expect(orgModel.findByOrganizationId).toHaveBeenCalledWith("agid");
    expect(result.isLeft);
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorQuery");
    }
  });
});
