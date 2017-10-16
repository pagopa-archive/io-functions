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
  it("should returns a defined option for valid message content ", () => {
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
  it("should returns an empty option for invalid message content", () => {
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
  it("should returns true if message content is well formed", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        markdown: m,
        subject: s
      },
      {
        markdown: m
      },
      {
        markdown: m,
        subject: null
      }
    ];
    fixtures.forEach(f => expect(isMessageContent(f)).toBe(true));
  });

  it("should returns false if message content is malformed", () => {
    const s: MessageSubject = toMessageSubject("Lorem ipsum dolor sit amet")
      .get;
    const m: MessageBodyMarkdown = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    ).get;

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        markdown: m,
        subject: "Lorem"
      },
      {
        subject: s
      },
      {
        markdown: "Lorem ipsum dolor sit amet",
        subject: s
      }
    ];
    fixtures.forEach(f => expect(isMessageContent(f)).toBeFalsy());
  });
});
