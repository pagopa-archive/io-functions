/* tslint:disable:no-any */
/* tslint:disable:no-big-function */
/* tslint:disable:no-duplicate-string */

import { isLeft, isRight } from "fp-ts/lib/Either";

import { AzureApiAuthMiddleware, UserGroup } from "../azure_api_auth";

const anAllowedGroupSet = new Set([UserGroup.ApiMessageWrite]);

const someHeaders = {
  "x-subscription-id": "s123",
  "x-user-groups": "ApiMessageWrite",
  "x-user-id": "u123"
};

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

describe("AzureApiAuthMiddleware", () => {
  it("should fail if no x-user-id header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-user-id": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if the x-user-id header is empty", async () => {
    const headers = {
      ...someHeaders,
      "x-user-id": ""
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if no x-subscription-id header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-subscription-id": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if the x-subscription-id header is empty", async () => {
    const headers = {
      ...someHeaders,
      "x-subscription-id": ""
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if no x-user-groups header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an empty x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an invalid x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ","
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if the user is not part of an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": "ApiDebugRead"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should succeed if the user is part of an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": "ApiMessageWrite"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.groups).toContain(UserGroup.ApiMessageWrite);
      expect(result.value.subscriptionId).toBe("s123");
      expect(result.value.userId).toBe("u123");
    }
  });

  it("should succeed if the user is part of at least an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": [
        UserGroup.ApiMessageRead,
        UserGroup.ApiMessageWrite
      ].join(",")
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.groups).toContain(UserGroup.ApiMessageWrite);
      expect(result.value.subscriptionId).toBe("s123");
      expect(result.value.userId).toBe("u123");
    }
  });

  it("should skip unknown groups in x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ["a", UserGroup.ApiMessageWrite, "bx", "!"].join(",")
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.groups).toEqual(new Set([UserGroup.ApiMessageWrite]));
    }
  });
});
