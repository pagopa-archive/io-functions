import {
  isNotificationStatus,
  NotificationStatus,
  toNotificationStatus
} from "../NotificationStatus";

import { toNotificationChannelStatus } from "../NotificationChannelStatus";

describe("Check NotificationStatus methods", () => {
  test("toNotificationStatus", () => {
    const notificationStatusOne: NotificationStatus = {
      email: toNotificationChannelStatus("QUEUED").get
    };
    const notificationStatusTwo = {
      email: "WRONG"
    };

    expect(toNotificationStatus(notificationStatusOne).get).toEqual(
      notificationStatusOne
    );
    expect(toNotificationStatus(notificationStatusTwo)).toEqual({});
    expect(toNotificationStatus({}).get).toEqual({});
  });

  test("isNotificationStatus", () => {
    const notificationStatusOne: NotificationStatus = {
      email: toNotificationChannelStatus("QUEUED").get
    };
    const notificationStatusTwo = {
      email: "WRONG"
    };
    const notificationStatusThree: NotificationStatus = {
      email: undefined
    };
    /* tslint:disable */
    const notificationStatusFour = {
      email: null
    };
    /* tslint:enable */

    expect(isNotificationStatus(notificationStatusOne)).toBe(true);
    expect(isNotificationStatus(notificationStatusTwo)).toBe(false);
    expect(isNotificationStatus(notificationStatusThree)).toBe(true);
    expect(isNotificationStatus(notificationStatusFour)).toBe(true);
  });
});
