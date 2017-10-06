import {
  ExtendedProfile,
  isExtendedProfile,
  toExtendedProfile
} from "../ExtendedProfile";

import { toEmailAddress } from "../EmailAddress";

import { toPreferredLanguages } from "../PreferredLanguages";

describe("ExtendedProfile#toExtendedProfile", () => {
  test("should returns a defined option for valid ExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };

    expect(toExtendedProfile(extendedProfile).get).toEqual(extendedProfile);
  });
  test("should returns an empty option for invalid ExtendedProfile", () => {
    const extendedProfile = {
      email: "address@",
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(toExtendedProfile(extendedProfile)).toEqual({});
  });
});

describe("ExtendedProfile#isExtendedProfile", () => {
  test("should returns true if ExtendedProfile is well formed", () => {
    const extendedProfile: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };

    expect(toExtendedProfile(extendedProfile).get).toEqual(extendedProfile);
  });

  test("should returns true if ExtendedProfile object does not have email property", () => {
    const extendedProfileTwo: ExtendedProfile = {
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);
  });
  test("should returns true if ExtendedProfile object does have email property set to null", () => {
    /* tslint:disable */
    const extendedProfileThree = {
      email: null,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });
  test("should returns false if ExtendedProfile object does have email property malformed", () => {
    const extendedProfileOne = {
      email: "address@",
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);
  });

  test("should returns true if ExtendedProfile object does not have preferred_languages property", () => {
    const extendedProfileTwo: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);
  });
  test("should returns true if ExtendedProfile object does have preferred_languages property set to null", () => {
    /* tslint:disable */
    const extendedProfileThree = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: null,
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });
  test("should returns false if ExtendedProfile object does have preferred_languages property malformed", () => {
    const extendedProfileOne = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: ["it"],
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);
  });

  test("should returns true if ExtendedProfile object does not have version property", () => {
    const extendedProfileTwo: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);
  });
  test("should returns true if ExtendedProfile object does have version property set to null", () => {
    /* tslint:disable */
    const extendedProfileThree = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: null
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });
  test("should returns false if ExtendedProfile object does have version property malformed", () => {
    const extendedProfileOne = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: "1"
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);
  });
});
