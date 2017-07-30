import { FunctionRequest, FunctionResponse, HttpContext, HttpStatusCodes } from "./azure-functions-types";

/**
 * An HTTP endpoint that responds to GET requests with "PONG"
 */
export function usersApi(context: HttpContext, req: FunctionRequest) {
  context.log("Admin Ping HTTP trigger function processed a request.");

  if (req.method === "GET") {
    context.res = {
      body: "PONG",
      status: HttpStatusCodes.OK,
    };
  } else {
    context.res = {
      status: HttpStatusCodes.MethodNotAllowed,
    };

  }

  context.done(null, { });
}
