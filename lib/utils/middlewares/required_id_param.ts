import { left, right } from "../either";

import { RequiredParamMiddleware } from "./required_param";

export const RequiredIdParamMiddleware = RequiredParamMiddleware<string>(
  (params) => {
    if (typeof params.id === "string" && (params.id as string).length > 0) {
      return right(params.id as string);
    } else {
      return left("The ID parameter is required");
    }
  },
);
