import { toRuntimeError, TransientError } from "../errors";

afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

describe("toRuntimeError", () => {
  it("should build a RuntimeError from an unknow Error", async () => {
    const runtimeError = toRuntimeError(new Error());
    expect(runtimeError.kind).toEqual("UnknownError");
  });
  it("should build a RuntimeError from a RuntimError", async () => {
    const runtimeError = toRuntimeError(TransientError(""));
    expect(runtimeError.kind).toEqual("TransientError");
  });
});
