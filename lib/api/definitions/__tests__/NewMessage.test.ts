import { toTimeToLive } from "../TimeToLive";

import { MessageContent } from "../MessageContent";

import { NewMessageDefaultAddresses } from "../NewMessageDefaultAddresses";

import { isNewMessage, NewMessage, toNewMessage } from "../NewMessage";

import { toMessageBodyMarkdown } from "../MessageBodyMarkdown";
import { toMessageSubject } from "../MessageSubject";

import { toEmailAddress } from "../EmailAddress";

describe("Check NewMessage methods", () => {
  test("toNewMessage", () => {
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

    const newMessageTwo = {
      content: undefined,
      default_addresses: nmda,
      time_to_live: toTimeToLive(3600).get
    };

    expect(toNewMessage(newMessageOne).get).toEqual(newMessageOne);
    expect(toNewMessage(newMessageTwo)).toEqual({});
  });

  test("isNewMessage", () => {
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
    expect(isNewMessage(newMessageOne)).toBe(true);
  });

  test("isNewMessage, check content property", () => {
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

    const newMessageOne = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: toTimeToLive(3600).get
    };
    expect(isNewMessage(newMessageOne)).toBe(false);
  });

  test("isNewMessage, check default_addresses property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const nmda = {
      email: "address@"
    };

    const newMessageOne: NewMessage = {
      content: messageContent,
      default_addresses: undefined,
      time_to_live: toTimeToLive(3600).get
    };
    expect(isNewMessage(newMessageOne)).toBe(true);

    /* tslint:disable */
    const newMessageTwo: NewMessage = {
      content: messageContent,
      default_addresses: null,
      time_to_live: toTimeToLive(3600).get
    };
    /* tslint:enable */
    expect(isNewMessage(newMessageTwo)).toBe(true);

    const newMessagethree = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: toTimeToLive(3600).get
    };
    expect(isNewMessage(newMessagethree)).toBe(false);
  });

  test("isNewMessage, check time_to_live property", () => {
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

    const newMessageOne = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: 3599
    };
    expect(isNewMessage(newMessageOne)).toBe(false);

    const newMessageTwo: NewMessage = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: undefined
    };
    expect(isNewMessage(newMessageTwo)).toBe(true);

    /* tslint:disable */
    const newMessageThree: NewMessage = {
      content: messageContent,
      default_addresses: nmda,
      time_to_live: null
    };
    /* tslint:enable */
    expect(isNewMessage(newMessageThree)).toBe(true);
  });
});
