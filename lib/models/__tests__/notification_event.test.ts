// tslint:disable:no-null-keyword
// tslint:disable:no-any

import * as t from "io-ts";

import { Option, Some } from "fp-ts/lib/Option";

import { NonEmptyString } from "../../utils/strings";

import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

import { isNotificationEvent } from "../notification_event";

import { IMessageContent } from "../message";

import { ICreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aMessageId = _getO(t.validate("A_MESSAGE_ID", NonEmptyString).toOption());
const aNotificationId = _getO(
  t.validate("A_NOTIFICATION_ID", NonEmptyString).toOption()
);

const aMessageBodyMarkdown = _getO(
  t.validate("test".repeat(80), MessageBodyMarkdown).toOption()
);

const aMessageContent: IMessageContent = {
  bodyMarkdown: aMessageBodyMarkdown
};

const aSenderMetadata: ICreatedMessageEventSenderMetadata = {
  departmentName: _getO(t.validate("IT", NonEmptyString).toOption()),
  organizationName: _getO(t.validate("AgID", NonEmptyString).toOption()),
  serviceName: _getO(t.validate("Test", NonEmptyString).toOption())
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
