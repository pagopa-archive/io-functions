// tslint:disable:no-object-mutation

import * as winston from "winston";

import { IContext } from "azure-function-express-cloudify";

/**
 * A custom Winston Transport that logs to the Azure Functions context
 */
class AzureContextTransport extends winston.Transport {
  private azureContext: IContext<{}>;

  constructor(azureContext: IContext<{}>, options: winston.TransportOptions) {
    super(options);

    this.name = "AzureContextLogger";
    this.level = options.level || "info";

    this.azureContext = azureContext;
  }

  public log(
    _: string,
    msg: string,
    __: object | undefined,
    callback: (err: Error | undefined, cont: boolean) => void,
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
export function configureAzureContextTransport(context: IContext<{}>, w: winston.Winston, level: string): void {
  const azureContextTransport = new AzureContextTransport(context, {
    level,
  });
  w.configure({
    level,
    transports: [ azureContextTransport ],
  });
}
