import {
  isPreferredLanguages,
  PreferredLanguages,
  toPreferredLanguages
} from "../PreferredLanguages";

import { PreferredLanguage } from "../PreferredLanguage";

describe("PreferredLanguages#toPreferredLanguages", () => {
  test("should returns a defined option for valid preferred languages", () => {
    const preferredLanguagesOne: PreferredLanguages = [
      PreferredLanguage.it_IT,
      PreferredLanguage.en_GB
    ];
    expect(toPreferredLanguages(preferredLanguagesOne).get).toEqual(
      preferredLanguagesOne
    );
  });
  test("should returns an empty option for invalid preferred languages", () => {
    const preferredLanguagesTwo: ReadonlyArray<string> = [
      PreferredLanguage.it_IT,
      "en_WRONG"
    ];
    expect(toPreferredLanguages(preferredLanguagesTwo)).toEqual({});
  });
});

describe("PreferredLanguages#isPreferredLanguages", () => {
  test("should returns true if PreferredLanguages is well formed", () => {
    const preferredLanguagesOne: PreferredLanguages = [
      PreferredLanguage.it_IT,
      PreferredLanguage.en_GB
    ];
    expect(isPreferredLanguages(preferredLanguagesOne)).toBe(true);
  });
  test("should returns true if PreferredLanguages is malformed", () => {
    const preferredLanguagesTwo: ReadonlyArray<string> = [
      PreferredLanguage.it_IT,
      "en_WRONG"
    ];
    expect(isPreferredLanguages(preferredLanguagesTwo)).toBe(false);
  });
});
