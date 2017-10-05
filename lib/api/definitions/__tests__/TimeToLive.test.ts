import { isTimeToLive, toTimeToLive } from "../TimeToLive";

import { toWithinRangeNumber, WithinRangeNumber } from "../../../utils/numbers";

describe("Check TimeToLive methods", () => {
  test("toTimeToLive", () => {
    const timeToLive: WithinRangeNumber<3600, 31536000> = toWithinRangeNumber(
      3600,
      3600,
      31536000
    ).get;

    expect(toTimeToLive(3600).get).toEqual(timeToLive);
  });

  test("isTimeToLive", () => {
    expect(isTimeToLive(3600)).toBe(true);
    expect(isTimeToLive(3599)).toBe(false);
  });
});
