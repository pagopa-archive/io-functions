/**
 * Contains Error types,
 * used to clarify the intent of a throw
 * and useful inside unit tests.
 */

export const enum ErrorTypes {
  TransientError = "TransientError",
  PermanentError = "PermanentError",
  UnknowError = "UnknowError"
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

export type UnknowError = IRuntimeError<ErrorTypes.UnknowError>;
export const UnknowError = RuntimeError(ErrorTypes.UnknowError);

/**
 * Construct a RuntimeError from an object.
 * Useful in try / catch blocks where the object caught is untyped.
 */
// tslint:disable-next-line:no-any
export const of = (error: any): RuntimeError =>
  error && ErrorTypes.hasOwnProperty(error.kind)
    ? error
    : UnknowError(
        error instanceof Error && error.message
          ? error.message
          : JSON.stringify(error),
        error instanceof Error ? error : undefined
      );

export type RuntimeError = TransientError | PermanentError | UnknowError;

// tslint:disable-next-line:no-any
export const isTransient = (error: any): error is TransientError =>
  error.kind && error.kind === ErrorTypes.TransientError;
