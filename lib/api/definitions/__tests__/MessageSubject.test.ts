import {
  isMessageSubject,
  MessageSubject,
  toMessageSubject
} from "../MessageSubject";

import { toWithinRangeString } from "../../../utils/strings";

describe("Check MessageSubject methods", () => {
  test("toMessageSubject", () => {
    const messageSubject: MessageSubject = toWithinRangeString(
      "Lorem ipsum dolor sit amet",
      10,
      120
    ).get;

    expect(toMessageSubject(messageSubject).get).toEqual(messageSubject);
  });
  test("isMessageSubject", () => {
    const messageSubjectOne: MessageSubject = toWithinRangeString(
      "Lorem ipsum dolor sit amet",
      10,
      120
    ).get;
    const messageSubjectTwo: string = "Lorem";

    expect(isMessageSubject(messageSubjectOne)).toBe(true);
    expect(isMessageSubject(messageSubjectTwo)).toBe(false);
  });
});
