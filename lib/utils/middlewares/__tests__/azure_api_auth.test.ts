// tslint:disable:no-any

import { AzureApiAuthMiddleware, UserGroup } from "../azure_api_auth";

const anAllowedGroupSet = new Set([UserGroup.Developers]);

describe("AzureApiAuthMiddleware", () => {

  it("should fail if no x-user-groups header is present", () => {
    const mockRequest = {
      header: jest.fn(() => undefined),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should fail if there's an empty x-user-groups header", () => {
    const mockRequest = {
      header: jest.fn(() => ""),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should fail if there's an invalid x-user-groups header", () => {
    const mockRequest = {
      header: jest.fn(() => ","),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should fail if there user is not part of an allowed group", () => {
    const mockRequest = {
      header: jest.fn(() => "NotAllowed"),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should succeed if the use is part of an allowed group", () => {
    const mockRequest = {
      header: jest.fn(() => "Developers,trusted-apps"),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right.groups).toContain(UserGroup.Developers);
      }
    });
  });

  it("should skip unknown groups in x-user-groups header", () => {
    const mockRequest = {
      header: jest.fn(() => "Developers,a,b,!"),
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right.groups).toEqual(new Set([UserGroup.Developers]));
      }
    });
  });

});
