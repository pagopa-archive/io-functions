// tslint:disable:no-null-keyword
// tslint:disable:no-any

import { toNonEmptyString } from "../../utils/strings";

import { toMessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

import { isNotificationEvent } from "../notification_event";

import { IMessageContent } from "../message";

import { ICreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";

const aMessageId = toNonEmptyString("A_MESSAGE_ID").get;
const aNotificationId = toNonEmptyString("A_NOTIFICATION_ID").get;

const aMessageBodyMarkdown = toMessageBodyMarkdown("test".repeat(80)).get;

const aMessageContent: IMessageContent = {
  bodyMarkdown: aMessageBodyMarkdown
};

const aSenderMetadata: ICreatedMessageEventSenderMetadata = {
  departmentName: toNonEmptyString("IT").get,
  organizationName: toNonEmptyString("agid").get,
  serviceName: toNonEmptyString("Test").get
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

    fixtures.forEach(f => expect(isNotificationEvent(f)).toBeTruthy());
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

    fixtures.forEach(f => expect(isNotificationEvent(f)).toBeFalsy());
  });
});
