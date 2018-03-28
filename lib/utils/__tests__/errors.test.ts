import { of, TransientError } from "../errors";

afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

describe("of", () => {
  it("should build a RuntimError from an unknow Error", async () => {
    const runtimeError = of(new Error());
    expect(runtimeError.kind).toEqual("UnknowError");
  });
  it("should build a RuntimError from a RuntimError", async () => {
    const runtimeError = of(TransientError(""));
    expect(runtimeError.kind).toEqual("TransientError");
  });
});
