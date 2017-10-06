import {
  isMessageResponse,
  MessageResponse,
  toMessageResponse
} from "../MessageResponse";

import { CreatedMessage } from "../CreatedMessage";

import { toMessageBodyMarkdown } from "../MessageBodyMarkdown";

import { MessageContent } from "../MessageContent";

import { toMessageSubject } from "../MessageSubject";

import { toFiscalCode } from "../FiscalCode";

import { NotificationStatus } from "../NotificationStatus";

import { toNotificationChannelStatus } from "../NotificationChannelStatus";

import { toTimeToLive } from "../TimeToLive";

describe("MessageResponse#toMessageResponse", () => {
  test("should returns a defined option for valid message response", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse: MessageResponse = {
      message: msg,
      notification: ns
    };

    expect(toMessageResponse(messageResponse).get).toEqual(messageResponse);
  });
  test("should returns an empty option for invalid message response", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg = {
      content: messageContent,
      fiscal_code: "WRONG",
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse = {
      message: msg,
      notification: ns
    };

    expect(toMessageResponse(messageResponse)).toEqual({});
  });
});

describe("MessageResponse#isMessageResponse", () => {
  test("should returns true if MessageResponse is well formed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse: MessageResponse = {
      message: msg,
      notification: ns
    };

    expect(isMessageResponse(messageResponse)).toBe(true);
  });

  test("should returns false if MessageResponse object does have message property malformed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg = {
      content: messageContent,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse = {
      message: msg,
      notification: ns
    };

    expect(isMessageResponse(messageResponse)).toBe(false);
  });

  test("should returns true if MessageResponse object does not have notification property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const messageResponseTwo = {
      message: msg
    };
    expect(isMessageResponse(messageResponseTwo)).toBe(true);
  });
  test("should returns true if MessageResponse object does have notification property set to null", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    /* tslint:disable */
    const messageResponseThree = {
      message: msg,
      notification: null
    };
    /* tslint:enable */
    expect(isMessageResponse(messageResponseThree)).toBe(true);
  });
  test("should returns false if MessageResponse object does have notification property malformed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns = {
      email: "WRONG"
    };

    const messageResponseOne = {
      message: msg,
      notification: ns
    };
    expect(isMessageResponse(messageResponseOne)).toBe(false);
  });
});
