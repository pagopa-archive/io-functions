import {
  isLimitedProfile,
  LimitedProfile,
  toLimitedProfile
} from "../LimitedProfile";

import { toPreferredLanguages } from "../PreferredLanguages";

describe("LimitedProfile#toLimitedProfile", () => {
  test("should returns a defined option for valid LimitedProfile", () => {
    const limitedProfileOne: LimitedProfile = {
      preferred_languages: toPreferredLanguages(["it_IT"]).get
    };
    expect(toLimitedProfile(limitedProfileOne).get).toEqual(limitedProfileOne);
  });
  test("should returns a ampty option for malformed LimitedProfile", () => {
    const limitedProfileTwo = {
      preferred_languages: ["it_"]
    };
    expect(toLimitedProfile(limitedProfileTwo)).toEqual({});
  });
});

describe("LimitedProfile#isLimitedProfile", () => {
  test("should returns true if LimitedProfile is well formed", () => {
    const limitedProfileOne: LimitedProfile = {
      preferred_languages: toPreferredLanguages(["it_IT"]).get
    };
    expect(isLimitedProfile(limitedProfileOne)).toBe(true);
  });
  test("should returns false if LimitedProfile is malformed", () => {
    const limitedProfileTwo = {
      preferred_languages: ["it_"]
    };
    expect(isLimitedProfile(limitedProfileTwo)).toBe(false);
  });
  test("should returns true if ExtendedProfile object does have preferred_languages property set to null", () => {
    /* tslint:disable */
    const limitedProfileThree = {
      preferred_languages: null
    };
    /* tslint:enable */
    expect(isLimitedProfile(limitedProfileThree)).toBe(true);
  });
  test("should returns true if ExtendedProfile object does not have preferred_languages property", () => {
    expect(isLimitedProfile({})).toBe(true);
  });
});
