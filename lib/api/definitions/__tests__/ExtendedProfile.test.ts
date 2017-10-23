import {
  ExtendedProfile,
  isExtendedProfile,
  toExtendedProfile
} from "../ExtendedProfile";

import { toEmailAddress } from "../EmailAddress";

import { toPreferredLanguages } from "../PreferredLanguages";

describe("ExtendedProfile#toExtendedProfile", () => {
  it("should returns a defined option for valid ExtendedProfile", () => {
    const extendedProfile: ExtendedProfile = {
      email: toEmailAddress("address@mail.org").get,
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };

    expect(toExtendedProfile(extendedProfile).get).toEqual(extendedProfile);
  });
  it("should returns an empty option for invalid ExtendedProfile", () => {
    const extendedProfile = {
      email: "address@",
      preferred_languages: toPreferredLanguages(["it_IT"]).get,
      version: 1
    };
    expect(toExtendedProfile(extendedProfile)).toEqual({});
  });
});

describe("ExtendedProfile#isExtendedProfile", () => {
  it("should returns true if ExtendedProfile is well formed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {},
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: 1
      },
      {
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: 1
      },
      {
        email: null,
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: 1
      },
      {
        email: toEmailAddress("address@mail.org").get,
        version: 1
      },
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: null,
        version: 1
      },
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: toPreferredLanguages(["it_IT"]).get
      },
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: null
      }
    ];
    fixtures.forEach(f => expect(isExtendedProfile(f)).toBe(true));
  });

  it("should returns false if ExtendedProfile object is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {
        email: "address@",
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: 1
      },
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: ["it"],
        version: 1
      },
      {
        email: toEmailAddress("address@mail.org").get,
        preferred_languages: toPreferredLanguages(["it_IT"]).get,
        version: "1"
      }
    ];

    fixtures.forEach(f => expect(isExtendedProfile(f)).toBeFalsy());
  });
});
