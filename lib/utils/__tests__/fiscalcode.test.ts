import { isFiscalCode } from "../fiscalcode";

describe("isFiscalCode", () => {

  it("should pass on valid fiscal codes", () => {
    const valids = [
      "FRLFRC74E04B157I",
    ];
    valids.forEach((v) => expect(isFiscalCode(v)).toBeTruthy());
  });

  it("should fail on invalid fiscal codes", () => {
    const invalids = [
      "",
      "frlfrc74e04b157i",
      "abc",
    ];
    invalids.forEach((v) => expect(isFiscalCode(v)).toBeFalsy());
  });

});
