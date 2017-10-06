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

describe("CreatedMessage#toCreatedMessage", () => {
  test("should returns a defined option for valid payloads", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const message: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    expect(toCreatedMessage(message).get).toEqual(message);
  });

  test("should returns an empty option for invalid payloads", () => {
    const message = {
      content: "WRONG",
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(toCreatedMessage(message)).toEqual({});
  });
});

describe("CreatedMessage#isCreatedMessage", () => {
  test("should returns true if CreatedMessage is well formed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const message: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    expect(isCreatedMessage(message)).toBe(true);
  });

  test("should returns true if CreatedMessage object does not have id property", () => {
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
  });
  test("should returns true if CreatedMessage object does have id property set to null", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

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
  });
  test("should returns false if CreatedMessage object does have id property malformed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };
    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: 12345,
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("should returns false if CreatedMessage object does not have fiscal_code property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageThree = {
      content: messageContent,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });
  test("should returns false if CreatedMessage object does have fiscal_code property mlformed", () => {
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
  });

  test("should returns true if CreatedMessage object does not have time_to_live property", () => {
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
  });
  test("should returns true if CreatedMessage object does have time_to_live property set to null", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

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
  });
  test("should returns false if CreatedMessage object does have time_to_live property mlformed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: "3600"
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("should returns true if CreatedMessage object does not have content property", () => {
    const messageOne = {
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageOne)).toBe(true);
  });
  test("should returns true if CreatedMessage object does have content property set to null", () => {
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
  });
  test("should returns false if CreatedMessage object does have content property mlformed", () => {
    const messageContent = {
      markdown: "Lorem ipsum",
      subject: "Lorem ipsum dolor sit amet"
    };

    const messageThree = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };
    expect(isCreatedMessage(messageThree)).toBe(false);
  });

  test("should returns true if CreatedMessage object does not have sender_organization_id property", () => {
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
  });
  test("should returns true if CreatedMessage object does have sender_organization_id property set to null", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

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
  });
  test("should returns false if CreatedMessage object does have sender_organization_id property mlformed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

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
