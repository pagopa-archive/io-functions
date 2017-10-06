import {
  isMessageBodyMarkdown,
  toMessageBodyMarkdown
} from "../MessageBodyMarkdown";

import { toWithinRangeString, WithinRangeString } from "../../../utils/strings";

import { Option } from "ts-option";

describe("MessageBodyMarkdown#toMessageBodyMarkdown", () => {
  test("should returns a defined option for valid MessageBodyMarkdown", () => {
    const text: string =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt";
    const t: Option<WithinRangeString<80, 10000>> = toWithinRangeString(
      text,
      80,
      10000
    );

    expect(toMessageBodyMarkdown(text)).toEqual(t);
  });
  test("should returns a empty option for a malformed MessageBodyMarkdown", () => {
    const text: string = "short";
    expect(toMessageBodyMarkdown(text)).toEqual({});
  });
});

describe("MessageBodyMarkdown#isMessageBodyMarkdown", () => {
  test("should returns true if MessageBodyMarkdown is well formed", () => {
    const text: string =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt";
    expect(isMessageBodyMarkdown(text)).toBe(true);
  });
  test("should returns false if MessageBodyMarkdown is malformed", () => {
    const text: string = "short";
    expect(isMessageBodyMarkdown(text)).toBe(false);
  });
});
