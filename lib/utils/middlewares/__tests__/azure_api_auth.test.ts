// tslint:disable:no-any

import { AzureApiAuthMiddleware } from "../azure_api_auth";

describe("AzureApiAuthMiddleware", () => {

  it("should fail if no x-user-groups header is present", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => undefined),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should fail if there's an empty x-user-groups header", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => ""),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should fail if there's an invalid x-user-groups header", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => ","),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toEqual("IResponseErrorForbidden");
      }
    });
  });

  it("should succeed if there's a valid x-user-groups header", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => "Developers,trusted-apps"),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right.groups).toEqual(["Developers", "trusted-apps"]);
      }
    });
  });

  it("should skip invalid groups in x-user-groups header", () => {
    const orgModel = jest.fn();

    const mockRequest = {
      header: jest.fn(() => "a,b,!"),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right.groups).toEqual(["a", "b"]);
      }
    });
  });

  it("should ignore invalid yaml", () => {
    const orgModel = jest.fn();

    const headers: any = {
      "x-user-groups": "a",
      "x-user-note": "xyz",
    };

    const mockRequest = {
      header: jest.fn((h) => headers[h]),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
      expect(result.isRight).toBeTruthy();
    });
  });

  it("should ignore the user organization from the custom attributes if it does not exist", () => {
    const orgModel = {
      findLastVersionById: jest.fn(() => Promise.resolve(null)),
    };

    const headers: any = {
      "x-user-groups": "a",
      "x-user-note": encodeURI([
        "# example custom attributes in yaml",
        "---",
        "organizationId: agid",
        "dummy: dummy",
        ""].join("\n"),
      ),
    };

    const mockRequest = {
      header: jest.fn((h) => headers[h]),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
      expect(orgModel.findLastVersionById).toHaveBeenCalledWith("agid");
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right.organization).toBeNull();
      }
    });
  });

  it("should fetch and return the user organization from the custom attributes", () => {
    const mockOrg = {
      name: "AGID",
    };

    const orgModel = {
      findLastVersionById: jest.fn(() => Promise.resolve(mockOrg as any)),
    };

    const headers: any = {
      "x-user-groups": "a",
      "x-user-note": encodeURI([
        "# example custom attributes in yaml",
        "---",
        "organizationId: agid",
        "dummy: dummy",
        ""].join("\n"),
      ),
    };

    const mockRequest = {
      header: jest.fn((h) => headers[h]),
    };

    const middleware = AzureApiAuthMiddleware(orgModel as any);

    return middleware(mockRequest as any).then((result) => {
      expect(mockRequest.header).toHaveBeenCalledWith("x-user-note");
      expect(orgModel.findLastVersionById).toHaveBeenCalledWith("agid");
      expect(result.isRight);
      if (result.isRight) {
        expect(result.right.organization).toEqual(mockOrg);
      }
    });
  });

});
