import {
  isNotificationChannelStatus,
  toNotificationChannelStatus
} from "../NotificationChannelStatus";

describe("Check NotificationChannelStatus methods", () => {
  test("toNotificationChannelStatus", () => {
    const notificationChannelStatusOne: string = "QUEUED";
    const notificationChannelStatusTwo: string = "WRONG";
    expect(
      toNotificationChannelStatus(notificationChannelStatusOne).get
    ).toEqual(notificationChannelStatusOne);
    expect(toNotificationChannelStatus(notificationChannelStatusTwo)).toEqual(
      {}
    );
  });

  test("isNotificationChannelStatus", () => {
    const notificationChannelStatusOne: string = "QUEUED";
    const notificationChannelStatusTwo: string = "WRONG";

    expect(isNotificationChannelStatus(notificationChannelStatusOne)).toBe(
      true
    );
    expect(isNotificationChannelStatus(notificationChannelStatusTwo)).toBe(
      false
    );
  });
});
