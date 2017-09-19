import { isFiscalCode } from "../../api/definitions/FiscalCode";

describe("isFiscalCode", () => {
  it("should pass on valid fiscal codes", () => {
    const valids: ReadonlyArray<string> = ["FRLFRC74E04B157I"];
    valids.forEach(v => expect(isFiscalCode(v)).toBeTruthy());
  });

  it("should fail on invalid fiscal codes", () => {
    const invalids: ReadonlyArray<string> = ["", "frlfrc74e04b157i", "abc"];
    invalids.forEach(v => expect(isFiscalCode(v)).toBeFalsy());
  });
});
