import { FiscalCode, isFiscalCode, toFiscalCode } from "../FiscalCode";

describe("Check FiscalCode methods", () => {
  test("toFiscalCode", () => {
    const fiscalCode: FiscalCode = "AAABBB01C01A000A";

    expect(toFiscalCode(fiscalCode).get).toEqual(fiscalCode);
  });

  test("isFiscalCode", () => {
    const fiscalCodeOne: FiscalCode = "AAABBB01C01A000A";
    const fiscalCodeTwo: FiscalCode = "AAA_BBB01C01A000A";

    expect(isFiscalCode(fiscalCodeOne)).toBe(true);
    expect(isFiscalCode(fiscalCodeTwo)).toBe(false);
  });
});
