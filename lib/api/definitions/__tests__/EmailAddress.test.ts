import { EmailAddress, isEmailAddress, toEmailAddress } from "../EmailAddress";

import { toEmailString } from "../../../utils/strings";

describe("EmailAddress#toEmailAddress", () => {
  test("should return a defined option for a valid email address", () => {
    const mail: EmailAddress = toEmailString("address@mail.org").get;
    expect(toEmailAddress(mail).get).toEqual(mail);
  });

  it("should return a empty option for a malformed email address", () => {
    expect(toEmailAddress("address@")).toEqual({});
  });
});

describe("EmailAddress#isEmailAddress", () => {
  it("should returns true if EmailAddress is well formed", () => {
    const mailOne: EmailAddress = toEmailString("address@mail.org").get;
    expect(isEmailAddress(mailOne)).toBe(true);
  });
  it("should returns false if EmailAddress is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [undefined, null, {}, "address@", ""];
    fixtures.forEach(f => expect(isEmailAddress(f)).toBe(false));
  });
});
