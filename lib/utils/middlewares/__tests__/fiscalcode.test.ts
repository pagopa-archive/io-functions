// tslint:disable:no-any

import { FiscalCodeMiddleware } from "../fiscalcode";

describe("FiscalCodeMiddleware", () => {

  it("should respond with a validation error if the fiscal code is not valid", () => {

    const mockRequest = {
      params: {
        fiscalcode: "not valid",
      },
    };

    return FiscalCodeMiddleware(mockRequest as any).then((result) => {
      expect(result.isLeft).toBeTruthy();
      if (result.isLeft) {
        expect(result.left.kind).toBe("IResponseErrorValidation");
      }
    });
  });

  it("should forward the fiscal code if it is valid", () => {

    const mockRequest = {
      params: {
        fiscalcode: "FRLFRC74E04B157I",
      },
    };

    return FiscalCodeMiddleware(mockRequest as any).then((result) => {
      expect(result.isRight).toBeTruthy();
      if (result.isRight) {
        expect(result.right).toEqual(mockRequest.params.fiscalcode);
      }
    });
  });

});
