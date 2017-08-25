/*
 * Type definitions for Azure functions
 */

/**
 * Default logger
 */
// tslint:disable-next-line:no-any
type Logger = (text: string, params?: any) => void;

/**
 * Level-specific loggers
 */
interface IContextLogger extends Logger {
  error: Logger;
  warn: Logger;
  info: Logger;
  verbose: Logger;
}

/**
 * Function context
 */
export interface IContext {
  invocationId: string;
  bindingData: {
    queueTrigger?: string;
    expirationTime?: Date;
    insertionTime?: Date;
    nextVisibleTime?: Date;
    id: string;
    popReceipt: string;
    dequeueCount: number;
  };

  log: IContextLogger;
  done: (err?: string | object, output?: object) => void;
}
