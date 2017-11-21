declare module "request-ip" {
  import * as express from "express";

  export function getClientIp(req: express.Request): string | undefined;
}
