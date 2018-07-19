/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

process.env = {
  ...process.env,
  NOTIFICATION_API_KEY: "xxx",
  NOTIFICATION_API_URL: "http://example.com"
};

import * as superagent from "superagent";
import { EmailAddress } from "../api/definitions/EmailAddress";
import { ExtendedProfile } from "../api/definitions/ExtendedProfile";
import { FiscalCode } from "../api/definitions/FiscalCode";
import {
  IProfileCreatedEvent,
  IProfileUpdatedEvent
} from "../controllers/profiles";
import { index } from "../profile_events_queue_handler";

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

// as superagent does not export request methods directly
// we must override the superagent.Request prototype
// so we can set up our jest mock to use it instead
// of the send() method
const mockSuperagentResponse = (response: any) => {
  const sendMock = jest.fn();
  // tslint:disable-next-line:no-object-mutation
  (superagent as any).Request.prototype.send = sendMock;
  return sendMock.mockReturnValueOnce(Promise.resolve(response));
};

const aFiscalCode = "SPNDNL80R13C523K" as FiscalCode;

const anOldProfile: ExtendedProfile = {
  blocked_inbox_or_channels: {},
  email: "xxx@example.com" as EmailAddress,
  is_inbox_enabled: false,
  is_webhook_enabled: true,
  preferred_languages: [],
  version: 1
};

const aNewProfile: ExtendedProfile = {
  ...anOldProfile,
  is_inbox_enabled: true,
  version: 2
};

const aProfileCreatedEvent: IProfileCreatedEvent = {
  fiscalCode: aFiscalCode,
  kind: "ProfileCreatedEvent",
  newProfile: aNewProfile
};

const aProfileUpdateEvent: IProfileUpdatedEvent = {
  fiscalCode: aFiscalCode,
  kind: "ProfileUpdatedEvent",
  newProfile: aNewProfile,
  oldProfile: anOldProfile
};

describe("profileEventsQueueHandlerIndex", () => {
  it("should send welcome message in case a new profile is created", async () => {
    const ctxMock = {
      log: jest.fn()
    };
    const res = {
      body: {},
      status: 200
    };
    const requestSpy = mockSuperagentResponse(res);
    const ret = await index(ctxMock as any, aProfileCreatedEvent);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { markdown: expect.anything(), subject: expect.anything() },
        time_to_live: expect.anything()
      })
    );
    expect(ret).toEqual(res);
  });
  it("should send welcome message in case is_inbox_enabled switches to true", async () => {
    const ctxMock = { log: jest.fn() };
    const res = {
      body: {},
      status: 200
    };
    const requestSpy = mockSuperagentResponse(res);
    const ret = await index(ctxMock as any, aProfileUpdateEvent);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { markdown: expect.anything(), subject: expect.anything() },
        time_to_live: expect.anything()
      })
    );
    expect(ret).toEqual(res);
  });

  it("should not send welcome message in case is_inbox_enabled was already true", async () => {
    const ctxMock = { log: jest.fn() };
    const res = {
      body: {},
      status: 200
    };
    const requestSpy = mockSuperagentResponse(res);
    const ret = await index(ctxMock as any, {
      ...aProfileUpdateEvent,
      oldProfile: { ...aProfileUpdateEvent.oldProfile, is_inbox_enabled: true }
    });
    expect(requestSpy).not.toHaveBeenCalledWith();
    expect(ret).toBeUndefined();
  });
});
