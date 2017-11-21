// tslint:disable:no-any
import { isNone, isSome } from "fp-ts/lib/Option";

import { isRight } from "fp-ts/lib/Either";

import { ClientIpMiddleware } from "../client_ip_middleware";

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

describe("ClientIpMiddleware", () => {
  it("should return the client IP", async () => {
    ["5.90.26.229", "5.90.26.229, 13.93.94.8:1112"].forEach(async h => {
      const mockRequest = {
        header: jest.fn(lookup({ "x-forwarded-for": h }))
      };
      const res = await ClientIpMiddleware(mockRequest as any);
      expect(isRight(res)).toBeTruthy();
      if (isRight(res)) {
        expect(isSome(res.value)).toBeTruthy();
        if (isSome(res.value)) {
          expect(res.value.value).toEqual("5.90.26.229");
        }
      }
    });
  });

  it("should return an empty value if client IP is not valid", async () => {
    [
      "",
      "123",
      "xyz, 5.90.26.229",
      "5.90.26.229.2, 13.93.94.8:1112"
    ].forEach(async h => {
      const mockRequest = {
        header: jest.fn(lookup({ "x-forwarded-for": h }))
      };
      const res = await ClientIpMiddleware(mockRequest as any);
      expect(isRight(res)).toBeTruthy();
      if (isRight(res)) {
        expect(isNone(res.value)).toBeTruthy();
      }
    });
  });
});
