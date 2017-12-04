// tslint:disable:no-any

import * as t from "io-ts";

import { Option, Some } from "fp-ts/lib/Option";
import { isICreatedMessageEvent } from "../created_message_event";

import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aMessageBodyMarkdown = _getO(
  t.validate("test".repeat(80), MessageBodyMarkdown).toOption()
);

describe("", () => {
  it("should validate valid events ICreatedMessageEvents", () => {
    const payloads: ReadonlyArray<any> = [
      {
        defaultAddresses: { email: "federico@teamdigitale.governo.it" },
        message: {
          _attachments: "attachments/",
          _etag: '"0000f431-0000-0000-0000-59bffc380000"',
          _rid: "LgNRANj9nwBgAAAAAAAAAA==",
          _self:
            "dbs/LgNRAA==/colls/LgNRANj9nwA=/docs/LgNRANj9nwBgAAAAAAAAAA==/",
          _ts: 1505754168,
          fiscalCode: "FRLFRC73E04B157I",
          id: "01BTAZ2HS1PWDJERA510FDXYV4",
          kind: "IRetrievedMessage",
          senderServiceId: "test",
          senderUserId: "u123"
        },
        messageContent: {
          bodyMarkdown: aMessageBodyMarkdown
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    ];
    payloads.forEach(payload => {
      expect(isICreatedMessageEvent(payload)).toBeTruthy();
    });
  });
});
