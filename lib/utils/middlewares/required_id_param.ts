import { none, some } from "ts-option";

import { RequiredParamMiddleware } from "./required_param";

export const RequiredIdParamMiddleware = RequiredParamMiddleware<string>(
  (params, response) => {
    if (typeof params.id === "string" && params.id.length > 0) {
      return some(params.id);
    } else {
      response.status(400).send({
        error: "The ID is required",
      });
      return none;
    }
  },
);
