import { FiscalCode, isFiscalCode, toFiscalCode } from "../FiscalCode";

import { toPatternString } from "../../../utils/strings";

describe("Check FiscalCode methods", () => {
  test("toFiscalCode", () => {
    const fiscalCode: FiscalCode = toPatternString(
      "AAABBB01C01A000A",
      "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
    ).get;

    expect(toFiscalCode(fiscalCode).get).toEqual(fiscalCode);
  });

  test("isFiscalCode", () => {
    const fiscalCode: FiscalCode = toPatternString(
      "AAABBB01C01A000A",
      "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
    ).get;

    expect(isFiscalCode(fiscalCode)).toBe(true);
  });
});
