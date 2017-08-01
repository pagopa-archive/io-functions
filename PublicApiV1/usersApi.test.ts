import { FunctionRequest, FunctionResponse, HttpContext, HttpMethod } from "./azure-functions-types";
import { usersApi } from "./usersApi";

test("Ping should reply pong", () => {

  const mockContext: HttpContext = {
    bindingData: null,
    bindings: null,
    done: (err) => {
      // As everything is passed to the done function we can do our asserts here.
      expect(err).toBeNull(); // We never call the done function with a Error.

      expect(mockContext.res.status).toBe(200); // When we succeed it should be 200.
      expect(mockContext.res.body).toBe("PONG"); // The response body built as in the function.
    },
    invocationId: "",
    log: () => { }, // We can use a jest mock here if the logs are important to us, but in this case it is not.
    res: null,
  };

  // This is the request we will use to test our function.
  const mockRequest: FunctionRequest = {
    body: {},
    headers: {},
    method: "GET",
    originalUrl: "/api/admin/ping",
    query: {},
    rawbody: null,
  };

  // Call the function
  usersApi(mockContext, mockRequest);
});
