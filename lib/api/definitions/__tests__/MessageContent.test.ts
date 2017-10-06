import { MessageSubject, toMessageSubject } from "../MessageSubject";

import {
  MessageBodyMarkdown,
  toMessageBodyMarkdown
} from "../MessageBodyMarkdown";

import {
  isMessageContent,
  MessageContent,
  toMessageContent
} from "../MessageContent";

describe("MessageContent#toMessageContent", () => {
  test("should returns a defined option for valid message content ", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    const messageContent: MessageContent = {
      markdown: m,
      subject: s
    };

    expect(toMessageContent(messageContent).get).toEqual(messageContent);
  });
  test("should returns an empty option for invalid message content", () => {
    const s: string = "Lorem";
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    const messageContent = {
      markdown: m,
      subject: s
    };

    expect(toMessageContent(messageContent)).toEqual({});
  });
});

describe("MessageContent#isMessageContent", () => {
  test("should returns true if message content is well formed", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    const messageContent: MessageContent = {
      markdown: m,
      subject: s
    };

    expect(isMessageContent(messageContent)).toBe(true);
  });

  test("should returns true if MessageContent object does not have subject property", () => {
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;
    const messageContentTwo: MessageContent = {
      markdown: m
    };
    expect(isMessageContent(messageContentTwo)).toBe(true);
  });
  test("should returns true if MessageContent object does have subject property set to null", () => {
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;
    /* tslint:disable */
    const messageContentThree = {
      markdown: m,
      subject: null
    };
    /* tslint:enable */
    expect(isMessageContent(messageContentThree)).toBe(true);
  });
  test("should returns false if MessageContent object does have subject property malformed", () => {
    const s: string = "Lorem";
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    const messageContentOne = {
      markdown: m,
      subject: s
    };
    expect(isMessageContent(messageContentOne)).toBe(false);
  });

  test("should returns true if MessageContent object does not have markdown property", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const messageContentTwo = {
      subject: s
    };
    expect(isMessageContent(messageContentTwo)).toBe(false);
  });
  test("should returns false if MessageContent object does have markdown property malformed", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const m: string = "Lorem ipsum dolor sit amet";

    const messageContentOne = {
      markdown: m,
      subject: s
    };
    expect(isMessageContent(messageContentOne)).toBe(false);
  });
});
