/*
 * Type definitions for Azure functions
 */

/**
 * Default logger
 */
type Logger = (text: any, params?: any) => void;

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
  done: (err?: any, output?: object) => void;
}
