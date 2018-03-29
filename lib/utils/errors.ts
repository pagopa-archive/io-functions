/**
 * Contains Error types,
 * used to clarify the intent of a throw
 * and useful inside unit tests.
 */

export enum ErrorTypes {
  TransientError = "TransientError",
  PermanentError = "PermanentError",
  UnknownError = "UnknownError",
  ExpiredError = "ExpiredError"
}

interface IRuntimeError<T extends ErrorTypes> {
  readonly kind: T;
  readonly message: string;
  readonly cause?: Error;
}

const RuntimeError = <T extends ErrorTypes>(
  kind: T
): ((message: string, cause?: Error) => IRuntimeError<T>) => {
  return (message: string, cause?: Error) => ({
    cause,
    kind,
    message
  });
};

export type TransientError = IRuntimeError<ErrorTypes.TransientError>;
export const TransientError = RuntimeError(ErrorTypes.TransientError);

export type PermanentError = IRuntimeError<ErrorTypes.PermanentError>;
export const PermanentError = RuntimeError(ErrorTypes.PermanentError);

export type UnknownError = IRuntimeError<ErrorTypes.UnknownError>;
export const UnknownError = RuntimeError(ErrorTypes.UnknownError);

export type ExpiredError = IRuntimeError<ErrorTypes.ExpiredError>;
export const ExpiredError = RuntimeError(ErrorTypes.ExpiredError);

/**
 * Construct a RuntimeError from an object.
 * Useful in try / catch blocks where the object caught is untyped.
 */
// tslint:disable-next-line:no-any
export const of = (error: any): RuntimeError =>
  error && ErrorTypes.hasOwnProperty(error.kind)
    ? error
    : UnknownError(
        error instanceof Error && error.message
          ? error.message
          : JSON.stringify(error),
        error instanceof Error ? error : undefined
      );

export type RuntimeError =
  | TransientError
  | PermanentError
  | UnknownError
  | ExpiredError;

// tslint:disable-next-line:no-any
export const isTransient = (error: any): error is TransientError =>
  error.kind && error.kind === ErrorTypes.TransientError;

// tslint:disable-next-line:no-any
export const isExpired = (error: any): error is ExpiredError =>
  error.kind && error.kind === ErrorTypes.ExpiredError;
