import {
  isNewMessageDefaultAddresses,
  NewMessageDefaultAddresses,
  toNewMessageDefaultAddresses
} from "../NewMessageDefaultAddresses";

import { toEmailAddress } from "../EmailAddress";

describe("NewMessageDefaultAddresses#toNewMessageDefaultAddresses", () => {
  it("should returns a defined option for valid new message default address", () => {
    const newMessageDefaultAddressesOne: NewMessageDefaultAddresses = {
      email: toEmailAddress("address@mail.org").get
    };

    expect(
      toNewMessageDefaultAddresses(newMessageDefaultAddressesOne).get
    ).toEqual(newMessageDefaultAddressesOne);
  });
  it("should returns an empty option for invalid new message default address", () => {
    const newMessageDefaultAddressesTwo = {
      email: "address@"
    };

    expect(toNewMessageDefaultAddresses(newMessageDefaultAddressesTwo)).toEqual(
      {}
    );
  });
});

describe("NewMessageDefaultAddresses#isNewMessageDefaultAddresses", () => {
  it("should returns true if NewMessageDefaultAddresses is well formed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        email: undefined
      },
      {
        email: null
      },
      {
        email: toEmailAddress("address@mail.org").get
      }
    ];
    fixtures.forEach(f => expect(isNewMessageDefaultAddresses(f)).toBe(true));
  });

  it("should returns false if NewMessageDefaultAddresses is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      null,
      {
        email: "address@"
      }
    ];
    fixtures.forEach(f => expect(isNewMessageDefaultAddresses(f)).toBeFalsy());
  });
});
