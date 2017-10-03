import { MessageSubject, toMessageSubject } from "../MessageSubject";

import {
  MessageBodyMarkdown,
  toMessageBodyMarkdown
} from "../MessageBodyMarkdown";

import { MessageContent, toMessageContent } from "../MessageContent";

describe("Check MessageContent type", () => {
  test("toMessageContent", () => {
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
});
