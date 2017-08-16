type Logger = (text: any) => void;

interface ContextLogger extends Logger {
  error: Logger;
  warn: Logger;
  info: Logger;
  verbose: Logger;
}

export type Context = {
  invocationId: string;
  bindingData: any;
  bindings: any;

  log: ContextLogger;
  done: (err?: any, output?: object) => void;
}
