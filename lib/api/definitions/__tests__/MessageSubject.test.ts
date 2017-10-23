import {
  isMessageSubject,
  MessageSubject,
  toMessageSubject
} from "../MessageSubject";

import { toWithinRangeString } from "../../../utils/strings";

describe("MessageSubject#toMessageSubject", () => {
  it("should returns a defined option for valid message subject", () => {
    const messageSubject: MessageSubject = toWithinRangeString(
      "Lorem ipsum dolor sit amet",
      10,
      120
    ).get;
    expect(toMessageSubject(messageSubject).get).toEqual(messageSubject);
  });
  it("should returns an empty option for invalid message subject", () => {
    const messageSubject: string = "Lorem";
    expect(toMessageSubject(messageSubject)).toEqual({});
  });
});
describe("MessageSubject#isMessageSubject", () => {
  it("should returns true if MessageSubject is well formed", () => {
    const messageSubjectOne: MessageSubject = toWithinRangeString(
      "Lorem ipsum dolor sit amet",
      10,
      120
    ).get;
    expect(isMessageSubject(messageSubjectOne)).toBe(true);
  });
  it("should returns false if MessageSubject is malformed", () => {
    const messageSubjectTwo: string = "Lorem";
    expect(isMessageSubject(messageSubjectTwo)).toBe(false);
  });
});
