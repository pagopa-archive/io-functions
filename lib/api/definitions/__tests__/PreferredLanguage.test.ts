import { isPreferredLanguage, toPreferredLanguage } from "../PreferredLanguage";

describe("PreferredLanguage#toPreferredLanguage", () => {
  it("should returns a defined option for valid preferred language", () => {
    const preferredLanguageOne: string = "it_IT";
    expect(toPreferredLanguage(preferredLanguageOne).get).toEqual(
      preferredLanguageOne
    );
  });
  it("should returns an empty option for invalid preferred language", () => {
    const preferredLanguageTwo: string = "it_WRONG";
    expect(toPreferredLanguage(preferredLanguageTwo)).toEqual({});
  });
});

describe("PreferredLanguage#isPreferredLanguage", () => {
  it("should returns true if PreferredLanguage is well formed", () => {
    const preferredLanguageOne: string = "it_IT";
    expect(isPreferredLanguage(preferredLanguageOne)).toBe(true);
  });
  it("should returns true if PreferredLanguage is malformed", () => {
    const preferredLanguageTwo: string = "it_WRONG";
    expect(isPreferredLanguage(preferredLanguageTwo)).toBe(false);
  });
});
