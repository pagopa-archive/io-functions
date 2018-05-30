import { TaxCode } from "../../api/definitions/TaxCode";

describe("TaxCode.is", () => {
  it("should pass on valid tax codes", () => {
    const valids: ReadonlyArray<string> = ["FRLFRC74E04B157I"];
    valids.forEach(v => expect(TaxCode.is(v)).toBeTruthy());
  });

  it("should fail on invalid tax codes", () => {
    const invalids: ReadonlyArray<string> = ["", "frlfrc74e04b157i", "abc"];
    invalids.forEach(v => expect(TaxCode.is(v)).toBeFalsy());
  });
});
