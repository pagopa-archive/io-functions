import {
  isNotificationStatus,
  NotificationStatus,
  toNotificationStatus
} from "../NotificationStatus";

import { toNotificationChannelStatus } from "../NotificationChannelStatus";

describe("NotificationStatus#toNotificationStatus", () => {
  it("should returns a defined option for valid notification status", () => {
    const notificationStatusOne: NotificationStatus = {
      email: toNotificationChannelStatus("QUEUED").get
    };

    expect(toNotificationStatus(notificationStatusOne).get).toEqual(
      notificationStatusOne
    );
  });
  it("should returns an empty option for invalid notification status", () => {
    const notificationStatusTwo = {
      email: "WRONG"
    };
    expect(toNotificationStatus(notificationStatusTwo)).toEqual({});
  });
});

describe("NotificationStatus#isNotificationStatus", () => {
  it("should returns true if NotificationStatus is well formed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        email: undefined
      },
      {
        email: null
      },
      {
        email: toNotificationChannelStatus("QUEUED").get
      }
    ];
    fixtures.forEach(f => expect(isNotificationStatus(f)).toBe(true));
  });

  it("should returns false if NotificationStatus is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      null,
      {
        email: "WRONG"
      }
    ];
    fixtures.forEach(f => expect(isNotificationStatus(f)).toBeFalsy());
  });
});
