import {
  isLimitedProfile,
  LimitedProfile,
  toLimitedProfile
} from "../LimitedProfile";

describe("Check LimitedProfile methods", () => {
  test("toLimitedProfile", () => {
    const limitedProfileOne: LimitedProfile = {
      preferred_languages: ["it_IT"]
    };
    const limitedProfileTwo: LimitedProfile = {
      preferred_languages: ["it_"]
    };

    expect(toLimitedProfile(limitedProfileOne).get).toEqual(limitedProfileOne);
    expect(toLimitedProfile(limitedProfileTwo)).toEqual({});
  });

  test("isLimitedProfile", () => {
    const limitedProfileOne: LimitedProfile = {
      preferred_languages: ["it_IT"]
    };
    const limitedProfileTwo: LimitedProfile = {
      preferred_languages: ["it_"]
    };
      /* tslint:disable */
    const limitedProfileThree: LimitedProfile = {
      preferred_languages: null
    };
    /* tslint:enable */

    expect(isLimitedProfile(limitedProfileOne)).toBe(true);
    expect(isLimitedProfile(limitedProfileTwo)).toBe(false);
    expect(isLimitedProfile(limitedProfileThree)).toBe(true);
    expect(isLimitedProfile({})).toBe(true);
  });
});
