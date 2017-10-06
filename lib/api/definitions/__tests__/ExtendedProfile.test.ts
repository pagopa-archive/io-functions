import {
  ExtendedProfile,
  isExtendedProfile,
  toExtendedProfile
} from "../ExtendedProfile";

import { toEmailAddress } from "../EmailAddress";

import { toPreferredLanguages } from "../PreferredLanguages";

describe("Check ExtendedProfile methods", () => {
  test("toExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };

    expect(toExtendedProfile(extendedProfile).get).toEqual(extendedProfile);
    // ExtendedProfile's properties are all not required.
    expect(toExtendedProfile({}).get).toEqual({});
  });

  test("isExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };

    expect(isExtendedProfile(extendedProfile)).toBe(true);
  });

  test("isExtendedProfile, check email property", () => {
    const extendedProfileOne = {
      email: "address@",
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: null,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });

  test("isExtendedProfile, check preferred_languages property", () => {
    const extendedProfileOne = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: ["it"],
      version: 1
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      version: 1
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: null,
      version: 1
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });

  test("isExtendedProfile, check version property", () => {
    const extendedProfileOne = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: "1"
    };
    expect(isExtendedProfile(extendedProfileOne)).toBe(false);

    const extendedProfileTwo: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get
    };
    expect(isExtendedProfile(extendedProfileTwo)).toBe(true);

    /* tslint:disable */
    const extendedProfileThree: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: null
    };
    /* tslint:enable */
    expect(isExtendedProfile(extendedProfileThree)).toBe(true);
  });
});
