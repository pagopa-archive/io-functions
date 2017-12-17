// tslint:disable:no-null-keyword
// tslint:disable:no-any

import { NonEmptyString } from "../../utils/strings";

import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

import { NotificationEvent } from "../notification_event";

import { MessageContent } from "../../api/definitions/MessageContent";

import { CreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aNotificationId = "A_NOTIFICATION_ID" as NonEmptyString;

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown
};

const aSenderMetadata: CreatedMessageEventSenderMetadata = {
  departmentName: "IT" as NonEmptyString,
  organizationName: "AgID" as NonEmptyString,
  serviceName: "Test" as NonEmptyString
};

describe("isNotificationEvent", () => {
  it("should return true for valid payloads", () => {
    const fixtures: ReadonlyArray<any> = [
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      }
    ];

    fixtures.forEach(f => expect(NotificationEvent.is(f)).toBeTruthy());
  });

  it("should return false for invalid payloads", () => {
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        messageId: aMessageId,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        notificationId: aNotificationId
      }
    ];

    fixtures.forEach(f => expect(NotificationEvent.is(f)).toBeFalsy());
  });
});
