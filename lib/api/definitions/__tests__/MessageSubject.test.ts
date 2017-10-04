import {
  isMessageSubject,
  MessageSubject,
  toMessageSubject
} from "../MessageSubject";

describe("Check MessageSubject methods", () => {
  test("toMessageSubject", () => {
    const messageSubject: MessageSubject = "Lorem ipsum dolor sit amet";

    expect(toMessageSubject(messageSubject).get).toEqual(messageSubject);
  });
  test("isMessageSubject", () => {
    const messageSubjectOne: MessageSubject = "Lorem ipsum dolor sit amet";
    const messageSubjectTwo: MessageSubject = "Lorem";

    expect(isMessageSubject(messageSubjectOne)).toBe(true);
    expect(isMessageSubject(messageSubjectTwo)).toBe(false);
  });
});
