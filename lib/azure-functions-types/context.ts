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
  readonly error: Logger;
  readonly warn: Logger;
  readonly info: Logger;
  readonly verbose: Logger;
}

/**
 * Function context
 */
export interface IContext {
  readonly invocationId: string;
  readonly bindingData: {
    readonly queueTrigger?: string;
    readonly expirationTime?: Date;
    readonly insertionTime?: Date;
    readonly nextVisibleTime?: Date;
    readonly id: string;
    readonly popReceipt: string;
    readonly dequeueCount: number;
  };

  readonly log: IContextLogger;
  readonly done: (err?: string | object, output?: object) => void;
}
