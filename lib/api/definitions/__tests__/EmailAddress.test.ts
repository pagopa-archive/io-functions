import { EmailAddress, isEmailAddress, toEmailAddress } from "../EmailAddress";

import { toEmailString } from "../../../utils/strings";

describe("Check EmailAddress methods", () => {
  test("toEmailAddress", () => {
    const mail: EmailAddress = toEmailString("address@mail.org").get;

    expect(toEmailAddress(mail).get).toEqual(mail);
  });

  test("isEmailAddress", () => {
    const mailOne: EmailAddress = toEmailString("address@mail.org").get;

    expect(isEmailAddress(mailOne)).toBe(true);

    const mailTwo: string = "address@";
    expect(isEmailAddress(mailTwo)).toBe(false);
    expect(isEmailAddress("")).toBe(false);
  });
});
