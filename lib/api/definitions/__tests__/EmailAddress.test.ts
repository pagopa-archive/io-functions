import { EmailAddress, isEmailAddress, toEmailAddress } from "../EmailAddress";

import { toEmailString } from "../../../utils/strings";

describe("EmailAddress#toEmailAddress", () => {
  test("should return a defined option for a valid email address", () => {
    const mail: EmailAddress = toEmailString("address@mail.org").get;
    expect(toEmailAddress(mail).get).toEqual(mail);
  });

  test("should return a empty option for a malformed email address", () => {
    expect(toEmailAddress("address@")).toEqual({});
  });
});

describe("EmailAddress#isEmailAddress", () => {
  test("should returns true if EmailAddress is well formed", () => {
    const mailOne: EmailAddress = toEmailString("address@mail.org").get;
    expect(isEmailAddress(mailOne)).toBe(true);
  });
  test("should returns false if EmailAddress is malformed", () => {
    expect(isEmailAddress("address@")).toBe(false);
  });
  test("should returns false if EmailAddress is empty", () => {
    expect(isEmailAddress("")).toBe(false);
  });
});
