import * as express from "express";
import * as FunctionsTypes from "azure-functions-types";

type Logger = (...args: any[]) => void;

type Loggers = {
  warn: Logger;
  verbose: Logger;
  error: Logger;
};

export interface IContext extends FunctionsTypes.Context {
  req: express.Request & { context: IContext };
  res: express.Response;
  log: Logger & Loggers;
}

export interface IContextWithBindings<T> extends IContext {
  bindings: T;
}