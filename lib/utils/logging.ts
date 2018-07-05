// tslint:disable:no-object-mutation

import { IContext } from "azure-function-express";
import * as logform from "logform";
import * as winston from "winston";
import * as Transport from "winston-transport";

const { timestamp, printf } = logform.format;

/**
 * A custom Winston Transport that logs to the Azure Functions context
 */
class AzureContextTransport extends Transport {
  // tslint:disable-next-line:readonly-keyword
  private azureContext: IContext<{}>;

  constructor(
    azureContext: IContext<{}>,
    options: Transport.TransportStreamOptions
  ) {
    super(options);
    this.level = options.level || "info";
    this.azureContext = azureContext;
  }

  public log(
    msg: string,
    callback: (err: Error | undefined, cont: boolean) => void
  ): void {
    if (this.silent) {
      return callback(undefined, true);
    }
    this.azureContext.log(msg);
    callback(undefined, true);
  }
}

/**
 * Configures Winston to log through the Azure Context log function
 */
export function configureAzureContextTransport(
  context: IContext<{}>,
  w: typeof winston,
  level: string
): void {
  const azureContextTransport = new AzureContextTransport(context, {
    level
  });
  w.configure({
    format: w.format.combine(
      timestamp(),
      w.format.splat(),
      w.format.simple(),
      printf(nfo => {
        return `${nfo.timestamp} [${nfo.level}]: ${nfo.message}`;
      })
    ),
    transports: [azureContextTransport]
  });
}
