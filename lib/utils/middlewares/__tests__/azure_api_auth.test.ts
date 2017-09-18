// tslint:disable:no-any

import { AzureApiAuthMiddleware, UserGroup } from "../azure_api_auth";

const anAllowedGroupSet = new Set([UserGroup.ApiMessageWrite]);

describe("AzureApiAuthMiddleware", () => {
  it("should fail if no x-user-groups header is present", async () => {
    const mockRequest = {
      header: jest.fn(() => undefined)
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an empty x-user-groups header", async () => {
    const mockRequest = {
      header: jest.fn(() => "")
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an invalid x-user-groups header", async () => {
    const mockRequest = {
      header: jest.fn(() => ",")
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if the user is not part of an allowed group", async () => {
    const mockRequest = {
      header: jest.fn(() => UserGroup.ApiDebugRead)
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isLeft).toBeTruthy();
    if (result.isLeft) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should succeed if the user is part of an allowed group", async () => {
    const mockRequest = {
      header: jest.fn(() => UserGroup.ApiMessageWrite)
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.groups).toContain(UserGroup.ApiMessageWrite);
    }
  });

  it("should succeed if the user is part of at least an allowed group", async () => {
    const mockRequest = {
      header: jest.fn(() =>
        [UserGroup.ApiMessageRead, UserGroup.ApiMessageWrite].join(",")
      )
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.groups).toContain(UserGroup.ApiMessageWrite);
    }
  });

  it("should skip unknown groups in x-user-groups header", async () => {
    const mockRequest = {
      header: jest.fn(() =>
        [UserGroup.ApiMessageWrite, "a", "b", "!"].join(",")
      )
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(result.isRight).toBeTruthy();
    if (result.isRight) {
      expect(result.right.groups).toEqual(new Set([UserGroup.ApiMessageWrite]));
    }
  });
});
