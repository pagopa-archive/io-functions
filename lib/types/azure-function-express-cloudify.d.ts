
declare module "azure-function-express-cloudify" {

  import * as express from "express";

  export function createAzureFunctionHandler(requestListener: express.Express): (context: IContext<{}>) => void;

  export interface IContext<T> {
    readonly log: (text: string, ...params: any[]) => void,
    readonly invocationId: string,
    readonly bindings: T,
  }

  export interface IRequestWithContext<T> extends express.Request {
    readonly context: IContext<T>;
  }

}
