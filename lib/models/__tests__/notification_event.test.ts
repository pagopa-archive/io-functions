// tslint:disable:no-null-keyword
// tslint:disable:no-any
import { Option, Some } from "fp-ts/lib/Option";

import { toNonEmptyString } from "../../utils/strings";

import { toMessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

import { isNotificationEvent } from "../notification_event";

import { IMessageContent } from "../message";

import { ICreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aMessageId = _getO(toNonEmptyString("A_MESSAGE_ID"));
const aNotificationId = _getO(toNonEmptyString("A_NOTIFICATION_ID"));

const aMessageBodyMarkdown = _getO(toMessageBodyMarkdown("test".repeat(80)));

const aMessageContent: IMessageContent = {
  bodyMarkdown: aMessageBodyMarkdown
};

const aSenderMetadata: ICreatedMessageEventSenderMetadata = {
  departmentName: _getO(toNonEmptyString("IT")),
  organizationName: _getO(toNonEmptyString("AgID")),
  serviceName: _getO(toNonEmptyString("Test"))
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
