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
  it("should returns a defined option for valid message response", () => {
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
  it("should returns an empty option for invalid message response", () => {
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
  it("should returns true if MessageResponse is well formed", () => {
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

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        message: msg,
        notification: ns
      },
      {
        message: msg
      },
      {
        message: msg,
        notification: null
      }
    ];

    fixtures.forEach(f => expect(isMessageResponse(f)).toBe(true));
  });

  it("should returns false if MessageResponse object is malformed", () => {
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

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        message: {
          content: messageContent,
          id: "12345",
          sender_organization_id: "Sender Organization",
          time_to_live: toTimeToLive(3600).get
        },
        notification: ns
      },
      {
        message: msg,
        notification: {
          email: "WRONG"
        }
      }
    ];
    fixtures.forEach(f => expect(isMessageResponse(f)).toBeFalsy());
  });
});
