import * as FunctionsTypes from "azure-functions-types";

type Logger = (...args: any[]) => void;

type Loggers = {
  warn: Logger;
  verbose: Logger;
  error: Logger;
};

export interface IContext extends FunctionsTypes.Context {
  log: Logger & Loggers;
}
