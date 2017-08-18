import * as express from "express";

import { withValidFiscalCode } from "../request_validators";

describe("withValidFiscalCode", () => {

  it("should pass on valid fiscal codes", () => {
    const mockHandler = jest.fn();
    const validatedHandler = withValidFiscalCode(mockHandler);
    const valids = [
      "FRLFRC74E04B157I",
    ];
    valids.forEach((v) => {
      const request = {
        params: {
          fiscalcode: v,
        },
      };
      const response = jest.fn();
      validatedHandler(
        request as express.Request,
        (response as any) as express.Response,
        (null as any) as express.NextFunction,
      );
      expect(mockHandler).toBeCalledWith(request, response, v);
    });
  });

  it("should no pass on invalid fiscal codes", () => {
    const mockHandler = jest.fn();
    const validatedHandler = withValidFiscalCode(mockHandler);
    const invalids = [
      "",
      "frlfrc74e04b157i",
      "abc",
    ];
    invalids.forEach((v) => {
      const request = {
        params: {
          fiscalcode: v,
        },
      };
      const response = {
        send: jest.fn(),
        status: jest.fn(),
      };
      response.status.mockReturnValue(response);
      response.send.mockReturnValue(response);
      validatedHandler(
        request as express.Request,
        (response as any) as express.Response,
        (null as any) as express.NextFunction,
      );
      expect(mockHandler).not.toBeCalled();
      expect(response.status).toBeCalledWith(400);
    });
  });

});
