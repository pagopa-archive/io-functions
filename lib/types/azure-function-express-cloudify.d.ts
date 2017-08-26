
declare module "azure-function-express-cloudify" {

  import * as express from "express";

  export function createAzureFunctionHandler(requestListener: express.Express): any;

  export interface IContext<T> {
    log: (text: string, ...params: any[]) => void,
    invocationId: string,
    bindings: T,
  }

  export interface IRequestWithContext<T> extends express.Request {
    context: IContext<T>;
  }

}
