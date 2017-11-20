// tslint:disable:no-any
import { isLeft, isRight } from "fp-ts/lib/Either";

import { FiscalCodeMiddleware } from "../fiscalcode";

describe("FiscalCodeMiddleware", () => {
  it("should respond with a validation error if the fiscal code is not valid", () => {
    const mockRequest = {
      params: {
        fiscalcode: "not valid"
      }
    };

    return FiscalCodeMiddleware(mockRequest as any).then(result => {
      expect(isLeft(result)).toBeTruthy();
      if (isLeft(result)) {
        expect(result.value.kind).toBe("IResponseErrorValidation");
      }
    });
  });

  it("should forward the fiscal code if it is valid", () => {
    const mockRequest = {
      params: {
        fiscalcode: "FRLFRC74E04B157I"
      }
    };

    return FiscalCodeMiddleware(mockRequest as any).then(result => {
      expect(isRight(result)).toBeTruthy();
      if (isRight(result)) {
        expect(result.value).toEqual(mockRequest.params.fiscalcode);
      }
    });
  });
});
