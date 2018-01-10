// tslint:disable:no-any
import { isNone, isSome } from "fp-ts/lib/Option";

import { isRight } from "fp-ts/lib/Either";

import { ClientIpMiddleware } from "../client_ip_middleware";

describe("ClientIpMiddleware", () => {
  it("should return the client IP", async () => {
    await Promise.all(
      ["5.90.26.229", "foobar, 5.90.26.229:1112"].map(async h => {
        const mockRequest = {
          headers: { "x-forwarded-for": h }
        };
        const res = await ClientIpMiddleware(mockRequest as any);
        expect(isRight(res)).toBeTruthy();
        if (isRight(res)) {
          expect(isSome(res.value)).toBeTruthy();
          if (isSome(res.value)) {
            expect(res.value.value).toEqual("5.90.26.229");
          }
        }
      })
    );
  });

  it("should return an empty value if client IP is not valid", async () => {
    await Promise.all(
      ["", "123", "xyz, 5.90.26.x"].map(async h => {
        const mockRequest = {
          headers: { "x-forwarded-for": h }
        };
        const res = await ClientIpMiddleware(mockRequest as any);
        expect(isRight(res)).toBeTruthy();
        if (isRight(res)) {
          expect(isNone(res.value)).toBeTruthy();
        }
      })
    );
  });
});
