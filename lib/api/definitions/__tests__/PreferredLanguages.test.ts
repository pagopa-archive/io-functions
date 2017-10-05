import {
  isPreferredLanguages,
  PreferredLanguages,
  toPreferredLanguages
} from "../PreferredLanguages";

import { PreferredLanguage } from "../PreferredLanguage";

describe("Check PreferredLanguages methods", () => {
  test("toPreferredLanguages", () => {
    const preferredLanguagesOne: PreferredLanguages = [
      PreferredLanguage.it_IT,
      PreferredLanguage.en_GB
    ];
    const preferredLanguagesTwo: PreferredLanguages = [
      PreferredLanguage.it_IT,
      "en_WRONG"
    ];

    expect(toPreferredLanguages(preferredLanguagesOne).get).toEqual(
      preferredLanguagesOne
    );
    expect(toPreferredLanguages(preferredLanguagesTwo)).toEqual({});
  });

  test("toPreferredLanguages", () => {
    const preferredLanguagesOne: PreferredLanguages = [
      PreferredLanguage.it_IT,
      PreferredLanguage.en_GB
    ];
    const preferredLanguagesTwo: PreferredLanguages = [
      PreferredLanguage.it_IT,
      "en_WRONG"
    ];

    expect(isPreferredLanguages(preferredLanguagesOne)).toBe(true);
    expect(isPreferredLanguages(preferredLanguagesTwo)).toBe(false);
  });
});
