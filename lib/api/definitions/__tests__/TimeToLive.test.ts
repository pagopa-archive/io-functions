import { isTimeToLive, toTimeToLive } from "../TimeToLive";

import { toWithinRangeNumber, WithinRangeNumber } from "../../../utils/numbers";

describe("TimeToLive#toTimeToLive", () => {
  test("should returns a defined option for valid time to live", () => {
    const timeToLive: WithinRangeNumber<3600, 31536000> = toWithinRangeNumber(
      3600,
      3600,
      31536000
    ).get;

    expect(toTimeToLive(3600).get).toEqual(timeToLive);
  });
  test("should returns an empty option for invalid time to live", () => {
    expect(toTimeToLive(3599)).toEqual({});
  });
});

describe("TimeToLive#isTimeToLive", () => {
  test("should returns true if TimeToLive is well formed", () => {
    expect(isTimeToLive(3600)).toBe(true);
  });
  test("should returns false if TimeToLive is malformed", () => {
    expect(isTimeToLive(3599)).toBe(false);
  });
});
