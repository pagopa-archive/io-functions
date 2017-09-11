import { left, right } from "../either";

import { RequiredParamMiddleware } from "./required_param";

/**
 * Returns an instance of RequiredParamMiddleware that extracts a non-empty "id"
 * parametere from the request URI parameters.
 */
export const RequiredIdParamMiddleware = RequiredParamMiddleware<string>(
  (params) => {
    if (typeof params.id === "string" && (params.id as string).length > 0) {
      return right(params.id as string);
    } else {
      return left("The 'id' parameter is required and must be non-empty.");
    }
  },
);
