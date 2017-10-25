import * as express from "express";
import * as helmet from "helmet";
import * as csp from "helmet-csp";
import * as referrerPolicy from "referrer-policy";

export function secureExpressApp(app: express.Express): void {
  // Set header `referrer-policy` to `no-referrer`
  app.use(referrerPolicy());

  // Set up Content Security Policy
  app.use(
    csp({
      directives: {
        defaultSrc: ["'none'"],
        upgradeInsecureRequests: true
      }
    })
  );

  // Set up the following HTTP headers
  // (see https://helmetjs.github.io/ for default values)
  //    strict-transport-security: max-age=15552000; includeSubDomains
  //    transfer-encoding: chunked
  //    x-content-type-options: nosniff
  //    x-dns-prefetch-control: off
  //    x-download-options: noopen
  //    x-frame-options: DENY
  //    x-xss-protection →1; mode=block
  app.use(
    helmet({
      frameguard: {
        action: "deny"
      }
    })
  );
}
