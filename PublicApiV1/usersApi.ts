import { FunctionRequest, FunctionResponse, HttpContext, HttpStatusCodes } from "./azure-functions-types";

/**
 * An HTTP endpoint that responds to GET requests with "PONG"
 */
export function usersApi(context: HttpContext, req: FunctionRequest) {
  context.log.verbose("Admin Ping HTTP trigger function processed a request.");

  let res: FunctionResponse | null = null;

  if (req.method === "GET") {
    res = {
      body: "PONG",
      status: HttpStatusCodes.OK,
    };
  } else {
    res = {
      status: HttpStatusCodes.MethodNotAllowed,
    };

  }

  context.done(null, res);
}
