import {
  CreatedMessageResponse,
  isCreatedMessageResponse,
  toCreatedMessageResponse
} from "../CreatedMessageResponse";

describe("Check CreatedMessageResponse methods", () => {
  test("toCreatedMessageResponse", () => {
    const createdMessageResponse: CreatedMessageResponse = {
      dry_run: true
    };

    expect(toCreatedMessageResponse(createdMessageResponse).get).toEqual(
      createdMessageResponse
    );
    expect(toCreatedMessageResponse({})).toEqual({});
  });

  test("isCreatedMessageResponse", () => {
    const createdMessageResponse: CreatedMessageResponse = {
      dry_run: true
    };

    expect(isCreatedMessageResponse(createdMessageResponse)).toBe(true);
    expect(isCreatedMessageResponse({})).toBe(false);
  });
});
