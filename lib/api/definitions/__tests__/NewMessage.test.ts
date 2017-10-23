import { toTimeToLive } from "../TimeToLive";

import { MessageContent } from "../MessageContent";

import { NewMessageDefaultAddresses } from "../NewMessageDefaultAddresses";

import { isNewMessage, NewMessage, toNewMessage } from "../NewMessage";

import { toMessageBodyMarkdown } from "../MessageBodyMarkdown";
import { toMessageSubject } from "../MessageSubject";

import { toEmailAddress } from "../EmailAddress";

describe("NewMessage#toNewMessage", () => {
  it("should returns a defined option for valid new message", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const nmda: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    const newMessageOne: NewMessage = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: toTimeToLive(3600).get
    };

    expect(toNewMessage(newMessageOne).get).toEqual(newMessageOne);
  });
  it("should returns an empty option for invalid new message", () => {
    const nmda: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    const newMessageTwo = {
      content: undefined,
      default_addresses: nmda,
      time_to_live: toTimeToLive(3600).get
    };
    expect(toNewMessage(newMessageTwo)).toEqual({});
  });
});
describe("NewMessage#isNewMessage", () => {
  it("should returns true if NewMessage is well formed", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const nmda: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        content: messageContent,
        default_addresses: nmda,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        default_addresses: nmda,
        time_to_live: undefined
      },
      {
        content: messageContent,
        default_addresses: nmda,
        time_to_live: null
      },
      {
        content: messageContent,
        default_addresses: undefined,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        default_addresses: null,
        time_to_live: toTimeToLive(3600).get
      }
    ];

    fixtures.forEach(f => expect(isNewMessage(f)).toBe(true));
  });

  it("should returns false if NewMessage is malformed", () => {
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent = {
      markdown: m.get,
      subject: "Lorem"
    };

    const nmda: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        content: null,
        default_addresses: nmda,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: undefined,
        default_addresses: nmda,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        default_addresses: nmda,
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        default_addresses: {
          email: "address@"
        },
        time_to_live: toTimeToLive(3600).get
      },
      {
        content: messageContent,
        default_addresses: nmda,
        time_to_live: 3599
      }
    ];
    fixtures.forEach(f => expect(isNewMessage(f)).toBeFalsy());
  });
});
