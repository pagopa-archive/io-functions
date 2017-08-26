import { FiscalCode, isFiscalCode } from "./fiscalcode";

import { IRequestMiddleware } from "./request_middleware";

export const FiscalCodeMiddleware: IRequestMiddleware<FiscalCode> =
  (request, response) => {
    const fiscalCode: string = request.params.fiscalcode;
    if (isFiscalCode(fiscalCode)) {
      return Promise.resolve(fiscalCode);
    } else {
      response.status(400).send(`The fiscal code [${fiscalCode}] is not valid.`);
      return Promise.reject(null);
    }
  };
