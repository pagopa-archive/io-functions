import { isPreferredLanguage, toPreferredLanguage } from "../PreferredLanguage";

describe("PreferredLanguage#toPreferredLanguage", () => {
  test("should returns a defined option for valid preferred language", () => {
    const preferredLanguageOne: string = "it_IT";
    expect(toPreferredLanguage(preferredLanguageOne).get).toEqual(
      preferredLanguageOne
    );
  });
  test("should returns an empty option for invalid preferred language", () => {
    const preferredLanguageTwo: string = "it_WRONG";
    expect(toPreferredLanguage(preferredLanguageTwo)).toEqual({});
  });
});

describe("PreferredLanguage#isPreferredLanguage", () => {
  test("should returns true if PreferredLanguage is well formed", () => {
    const preferredLanguageOne: string = "it_IT";
    expect(isPreferredLanguage(preferredLanguageOne)).toBe(true);
  });
  test("should returns true if PreferredLanguage is malformed", () => {
    const preferredLanguageTwo: string = "it_WRONG";
    expect(isPreferredLanguage(preferredLanguageTwo)).toBe(false);
  });
});
