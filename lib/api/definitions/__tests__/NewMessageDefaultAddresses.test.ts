import {
  isNewMessageDefaultAddresses,
  NewMessageDefaultAddresses,
  toNewMessageDefaultAddresses
} from "../NewMessageDefaultAddresses";

import { toEmailAddress } from "../EmailAddress";

describe("NewMessageDefaultAddresses#toNewMessageDefaultAddresses", () => {
  test("should returns a defined option for valid new message default address", () => {
    const newMessageDefaultAddressesOne: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    expect(
      toNewMessageDefaultAddresses(newMessageDefaultAddressesOne).get
    ).toEqual(newMessageDefaultAddressesOne);
  });
  test("should returns an empty option for invalid new message default address", () => {
    const newMessageDefaultAddressesTwo = {
      email: "address@"
    };

    expect(toNewMessageDefaultAddresses(newMessageDefaultAddressesTwo)).toEqual(
      {}
    );
  });
});

describe("NewMessageDefaultAddresses#isNewMessageDefaultAddresses", () => {
  test("should returns true if NewMessageDefaultAddresses is well formed", () => {
    const newMessageDefaultAddressesOne: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };
    expect(isNewMessageDefaultAddresses(newMessageDefaultAddressesOne)).toBe(
      true
    );
  });

  test("should returns true if NewMessageDefaultAddresses object does not have email property", () => {
    const newMessageDefaultAddressesThree = {};
    expect(isNewMessageDefaultAddresses(newMessageDefaultAddressesThree)).toBe(
      true
    );
  });
  test("should returns true if NewMessageDefaultAddresses object does have email property set to null", () => {
    /* tslint:disable */
    const newMessageDefaultAddressesFour = {
      email: null
    };
    /* tslint:enable */
    expect(isNewMessageDefaultAddresses(newMessageDefaultAddressesFour)).toBe(
      true
    );
  });
  test("should returns false if NewMessageDefaultAddresses object does have email property malformed", () => {
    const newMessageDefaultAddressesTwo = {
      email: "address@"
    };
    expect(isNewMessageDefaultAddresses(newMessageDefaultAddressesTwo)).toBe(
      false
    );
  });
});
