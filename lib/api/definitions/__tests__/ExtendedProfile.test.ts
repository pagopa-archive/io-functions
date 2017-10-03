import {
  ExtendedProfile,
  isExtendedProfile,
  toExtendedProfile
} from "../ExtendedProfile";

describe("Check ExtendedProfile methods", () => {
  test("toExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it_IT"],
      version: 1
    };

    expect(toExtendedProfile(extendedProfile).get).toEqual(extendedProfile);
    // ExtendedProfile's properties are all not required.
    expect(toExtendedProfile({}).get).toEqual({});
  });

  test("isExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it_IT"],
      version: 1
    };

    expect(isExtendedProfile(extendedProfile)).toBe(true);
  });

  test("isExtendedProfile, check email property", () => {
    const extendedProfileOne: ExtendedProfile = {
      email: "address@",
      preferred_languages: ["it_IT"],
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      preferred_languages: ["it_IT"],
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: null,
      preferred_languages: ["it_IT"],
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });

  test("isExtendedProfile, check preferred_languages property", () => {
    const extendedProfileOne: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it"],
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      email: "address@mail.org",
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: null,
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });

  test("isExtendedProfile, check version property", () => {
    const extendedProfileOne: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it_IT"],
      version: "1"
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it_IT"]
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: "address@mail.org",
      preferred_languages: ["it_IT"],
      version: null
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });
});
