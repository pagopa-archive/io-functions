
declare module "azure-function-express-cloudify" {

  import * as express from "express";

  export function createAzureFunctionHandler(requestListener: express.Express): any;

  interface Context<T> {
    log: (text: string, ...params: any[]) => void,
    invocationId: string,
    bindings: T,
  }

  export interface IRequestWithContext<T> extends express.Request {
    context: Context<T>,
  }

}
