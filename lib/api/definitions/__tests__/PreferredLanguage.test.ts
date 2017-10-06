import { isPreferredLanguage, toPreferredLanguage } from "../PreferredLanguage";

describe("Check PreferredLanguage methods", () => {
  test("toPreferredLanguage", () => {
    const preferredLanguageOne: string = "it_IT";
    const preferredLanguageTwo: string = "it_WRONG";

    expect(toPreferredLanguage(preferredLanguageOne).get).toEqual(
      preferredLanguageOne
    );
    expect(toPreferredLanguage(preferredLanguageTwo)).toEqual({});
  });

  test("isPreferredLanguage", () => {
    const preferredLanguageOne: string = "it_IT";
    const preferredLanguageTwo: string = "it_WRONG";

    expect(isPreferredLanguage(preferredLanguageOne)).toBe(true);
    expect(isPreferredLanguage(preferredLanguageTwo)).toBe(false);
  });
});
