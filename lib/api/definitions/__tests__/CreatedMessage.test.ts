import {
  CreatedMessage,
  isCreatedMessage,
  toCreatedMessage
} from "../CreatedMessage";

import { toMessageBodyMarkdown } from "../MessageBodyMarkdown";

import { MessageContent } from "../MessageContent";

import { toMessageSubject } from "../MessageSubject";

import { toFiscalCode } from "../FiscalCode";

import { toTimeToLive } from "../TimeToLive";

describe("Check CreatedMessage methods", () => {
  test("toCreatedMessage", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const message = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const createdMessage: CreatedMessage = toCreatedMessage(message).get;
    expect(createdMessage).toEqual(message);
  });

  test("isCreatedMessage", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const message = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    expect(isCreatedMessage(message)).toBe(true);
  });

  test("isCreatedMessage, check id property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageOne = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageOne)).toBe(true);

    /* tslint:disable */
    const messageTwo = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: null,
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    /* tslint:enable */
    expect(isCreatedMessage(messageTwo)).toBe(true);

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: 12345,
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("isCreatedMessage, check fiscal_code property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageOne = {
      content: messageContent,
      fiscal_code: "WRONG",
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageOne)).toBe(false);

    const messageTwo = {
      content: messageContent,
      fiscal_code: 111111,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageTwo)).toBe(false);

    const messageThree = {
      content: messageContent,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("isCreatedMessage, check time_to_live property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageOne = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization"
    };
    expect(isCreatedMessage(messageOne)).toBe(true);

    /* tslint:disable */
    const messageTwo = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: null
    };
    /* tslint:enable */
    expect(isCreatedMessage(messageTwo)).toBe(true);

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: "3600"
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("isCreatedMessage, check content property", () => {
    const messageContent: MessageContent = {
      markdown: "Lorem ipsum",
      subject: "Lorem ipsum dolor sit amet"
    };

    const messageOne = {
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageOne)).toBe(true);

    /* tslint:disable */
    const messageTwo = {
      content: null,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    /* tslint:enable */
    expect(isCreatedMessage(messageTwo)).toBe(true);

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("isCreatedMessage, check sender_organization_id property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageOne = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageOne)).toBe(false);

    /* tslint:disable */
    const messageTwo = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: null,
      time_to_live: toTimeToLive(3600).get
    };
    /* tslint:enable */
    expect(isCreatedMessage(messageTwo)).toBe(false);

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: 123456789,
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });
});
