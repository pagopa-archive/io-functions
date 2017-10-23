import {
  isLimitedProfile,
  LimitedProfile,
  toLimitedProfile
} from "../LimitedProfile";

import { toPreferredLanguages } from "../PreferredLanguages";

describe("LimitedProfile#toLimitedProfile", () => {
  it("should returns a defined option for valid LimitedProfile", () => {
    const limitedProfileOne: LimitedProfile = {
      preferred_languages: toPreferredLanguages(["it_IT"]).get
    };
    expect(toLimitedProfile(limitedProfileOne).get).toEqual(limitedProfileOne);
  });
  it("should returns a ampty option for malformed LimitedProfile", () => {
    const limitedProfileTwo = {
      preferred_languages: ["it_"]
    };
    expect(toLimitedProfile(limitedProfileTwo)).toEqual({});
  });
});

describe("LimitedProfile#isLimitedProfile", () => {
  it("should returns true if LimitedProfile is well formed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      // undefined,
      // null,
      {},
      {
        preferred_languages: null
      },
      {
        preferred_languages: toPreferredLanguages(["it_IT"]).get
      }
    ];
    fixtures.forEach(f => expect(isLimitedProfile(f)).toBe(true));
  });
  it("should returns false if LimitedProfile is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {
        preferred_languages: ["it_"]
      }
    ];
    fixtures.forEach(f => expect(isLimitedProfile(f)).toBeFalsy());
  });
});
