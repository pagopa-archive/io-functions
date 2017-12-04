import * as t from "io-ts";

import { toAuthorizedCIDRs } from "../../models/service";
import { ClientIp } from "../middlewares/client_ip_middleware";
import { ResponseSuccessJson } from "../response";
import { IPString } from "../strings";
import { Tuple2 } from "../tuples";

import { checkSourceIpForHandler } from "../source_ip_check";

describe("checkSourceIpForHandler", () => {
  // a sample request handler that gets the source IP and allowed CIDRs
  const handler = (__: ClientIp, ___: ReadonlySet<string>) => {
    return Promise.resolve(ResponseSuccessJson("OK"));
  };

  // extracts the source IP and the allowed CIDRs from the parameters passed
  // to the request handler
  function extractor(
    sourceIp: ClientIp,
    cidrs: ReadonlySet<string>
  ): Tuple2<ClientIp, ReadonlySet<string>> {
    return Tuple2(sourceIp, cidrs);
  }

  // wrap the request handler with the source IP checker
  const checkedHandler = checkSourceIpForHandler(handler, extractor);

  it("should let the request pass if no CIDRs have been set", async () => {
    const result = await checkedHandler(
      t.validate("127.0.0.1", IPString).toOption(),
      toAuthorizedCIDRs([])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should let the request pass if IP matches CIDRs", async () => {
    const result = await checkedHandler(
      t.validate("192.168.1.1", IPString).toOption(),
      toAuthorizedCIDRs(["192.168.1.0/24"])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should let the request pass if IP matches IPs", async () => {
    const result = await checkedHandler(
      t.validate("192.168.10.10", IPString).toOption(),
      toAuthorizedCIDRs(["192.168.10.10"])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should reject the request if IP does not match CIDRs", async () => {
    const result = await checkedHandler(
      t.validate("10.0.1.1", IPString).toOption(),
      toAuthorizedCIDRs(["192.168.1.0/24"])
    );
    expect(result.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
  });
});
