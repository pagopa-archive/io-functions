// tslint:disable:no-any
import { isLeft, isRight } from "fp-ts/lib/Either";

import { TaxCodeMiddleware } from "../taxcode";

describe("TaxCodeMiddleware", () => {
  it("should respond with a validation error if the tax code is not valid", () => {
    const mockRequest = {
      params: {
        taxcode: "not valid"
      }
    };

    return TaxCodeMiddleware(mockRequest as any).then(result => {
      expect(isLeft(result)).toBeTruthy();
      if (isLeft(result)) {
        expect(result.value.kind).toBe("IResponseErrorValidation");
      }
    });
  });

  it("should forward the tax code if it is valid", () => {
    const mockRequest = {
      params: {
        taxcode: "FRLFRC74E04B157I"
      }
    };

    return TaxCodeMiddleware(mockRequest as any).then(result => {
      expect(isRight(result)).toBeTruthy();
      if (isRight(result)) {
        expect(result.value).toEqual(mockRequest.params.taxcode);
      }
    });
  });
});
