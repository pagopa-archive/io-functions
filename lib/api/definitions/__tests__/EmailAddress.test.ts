import { EmailAddress, isEmailAddress, toEmailAddress } from "../EmailAddress";

describe("Check EmailAddress methods", () => {
  test("toEmailAddress", () => {
    const mail: EmailAddress = "address@mail.org";

    expect(toEmailAddress(mail).get).toEqual(mail);
  });

  test("isEmailAddress", () => {
    const mailOne: EmailAddress = "address@mail.org";

    expect(isEmailAddress(mailOne)).toBe(true);

    const mailTwo: EmailAddress = "address@";
    expect(isEmailAddress(mailTwo)).toBe(false);
    expect(isEmailAddress("")).toBe(false);
  });
});
