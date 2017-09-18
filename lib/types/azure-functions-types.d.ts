import * as FunctionTypes from "azure-functions-types";

declare module "azure-functions-types" {
  type Logger = (...args: any[]) => void;

  type Loggers = {
    warn: Logger;
    verbose: Logger;
    error: Logger;
  };

  interface IContext extends FunctionTypes.Context {
    log: Logger & Loggers;
  }
}
