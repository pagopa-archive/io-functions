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
  it("should returns a defined option for valid payloads", () => {
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

  it("should returns an empty option for invalid payloads", () => {
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
  it("should returns true if CreatedMessage is well formed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: null,
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization"
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: null
      },
      {
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: null,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      }
    ];

    fixtures.forEach(f => expect(isCreatedMessage(f)).toBe(true));
  });

  it("should returns true if CreatedMessage is malformed formed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: 12345,
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: "WRONG",
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: "3600"
      },
      {
        content: {
          markdown: "Lorem ipsum",
          subject: "Lorem ipsum dolor sit amet"
        },
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: "Sender Organization",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: null,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
        id: "12345",
        sender_organization_id: 123456789,
        time_to_live: toTimeToLive(3600).get
      }
    ];

    fixtures.forEach(f => expect(isCreatedMessage(f)).toBeFalsy());
  });
});
