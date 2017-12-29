// tslint:disable:no-any

import { CreatedMessageEvent } from "../created_message_event";

import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";
import { TimeToLive } from "../../api/definitions/TimeToLive";

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

describe("", () => {
  it("should validate valid events CreatedMessageEvents", () => {
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
          kind: "RetrievedMessage",
          senderServiceId: "test",
          senderUserId: "u123",
          timeToLive: 3600 as TimeToLive
        },
        messageContent: {
          markdown: aMessageBodyMarkdown
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    ];
    payloads.forEach(payload => {
      expect(CreatedMessageEvent.is(payload)).toBeTruthy();
    });
  });
});
