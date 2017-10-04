import {
  isNotificationChannelStatus,
  toNotificationChannelStatus
} from "../NotificationChannelStatus";

describe("Check NotificationChannelStatus methods", () => {
  test("toNotificationChannelStatus", () => {
    const notificationChannelStatusOne = "QUEUED";
    const notificationChannelStatusTwo = "WRONG";
    expect(
      toNotificationChannelStatus(notificationChannelStatusOne).get
    ).toEqual(notificationChannelStatusOne);
    expect(toNotificationChannelStatus(notificationChannelStatusTwo)).toEqual(
      {}
    );
  });

  test("isNotificationChannelStatus", () => {
    const notificationChannelStatusOne = "QUEUED";
    const notificationChannelStatusTwo = "WRONG";

    expect(isNotificationChannelStatus(notificationChannelStatusOne)).toBe(
      true
    );
    expect(isNotificationChannelStatus(notificationChannelStatusTwo)).toBe(
      false
    );
  });
});
