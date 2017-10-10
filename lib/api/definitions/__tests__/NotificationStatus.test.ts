import {
  isNotificationStatus,
  NotificationStatus,
  toNotificationStatus
} from "../NotificationStatus";

import { toNotificationChannelStatus } from "../NotificationChannelStatus";

describe("NotificationStatus#toNotificationStatus", () => {
  test("should returns a defined option for valid notification status", () => {
    const notificationStatusOne: NotificationStatus = {
      email: toNotificationChannelStatus("QUEUED").get
    };

    expect(toNotificationStatus(notificationStatusOne).get).toEqual(
      notificationStatusOne
    );
  });
  test("should returns an empty option for invalid notification status", () => {
    const notificationStatusTwo = {
      email: "WRONG"
    };
    expect(toNotificationStatus(notificationStatusTwo)).toEqual({});
  });
});

describe("NotificationStatus#isNotificationStatus", () => {
  test("should returns true if NotificationStatus is well formed", () => {
    const notificationStatusOne: NotificationStatus = {
      email: toNotificationChannelStatus("QUEUED").get
    };
    expect(isNotificationStatus(notificationStatusOne)).toBe(true);
  });

  test("should returns true if NotificationStatus object does not have email property", () => {
    expect(isNotificationStatus({})).toBe(true);
  });
  test("should returns true if NotificationStatus object does have notification email set to null", () => {
    /* tslint:disable */
    const notificationStatusFour = {
      email: null
    };
    /* tslint:enable */
    expect(isNotificationStatus(notificationStatusFour)).toBe(true);
  });
  test("should returns false if NotificationStatus is malformed", () => {
    const notificationStatusTwo = {
      email: "WRONG"
    };
    expect(isNotificationStatus(notificationStatusTwo)).toBe(false);
  });
});
