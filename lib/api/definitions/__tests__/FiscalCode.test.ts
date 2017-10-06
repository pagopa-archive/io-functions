import { FiscalCode, isFiscalCode, toFiscalCode } from "../FiscalCode";

import { toPatternString } from "../../../utils/strings";

describe("FiscalCode#toFiscalCode", () => {
  test("should returns a defined option for valid fiscal code", () => {
    const fiscalCode: FiscalCode = toPatternString(
      "AAABBB01C01A000A",
      "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
    ).get;

    expect(toFiscalCode(fiscalCode).get).toEqual(fiscalCode);
  });
  test("should returns a empty option for malformed fiscal code", () => {
    expect(toFiscalCode("abc")).toEqual({});
  });
});

describe("FiscalCode#isFiscalCode", () => {
  test("should returns true if fiscal code is well formed", () => {
    const fiscalCode: FiscalCode = toPatternString(
      "AAABBB01C01A000A",
      "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
    ).get;

    expect(isFiscalCode(fiscalCode)).toBe(true);
  });
  test("should returns false if fiscal code is malformed", () => {
    expect(isFiscalCode("abc")).toBe(false);
  });
});
