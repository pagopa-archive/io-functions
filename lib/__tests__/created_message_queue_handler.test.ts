// tslint:disable:no-any

import {
  handleMessage,
  index,
  ProcessingError,
  processReject,
  processResolve,
} from "../created_message_queue_handler";
import { ICreatedMessageEvent } from "../models/created_message_event";
import { IRetrievedMessage } from "../models/message";

import { none, some } from "ts-option";
import { toBodyShort } from "../api/definitions/BodyShort";
import { FiscalCode, toFiscalCode } from "../api/definitions/FiscalCode";
import {
  INewNotification,
  INotificationChannelEmail,
  NotificationChannelStatus,
} from "../models/notification";
import { IRetrievedProfile } from "../models/profile";
// import {
//   handleMessage,
//   ProcessingError,
// } from "../queue_handlers/queued_message_handler";
import { left, right } from "../utils/either";
import { toNonNegativeNumber } from "../utils/numbers";
import { toNonEmptyString } from "../utils/strings";

const aCorrectFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;
const aWrongFiscalCode = "FRLFRC74E04B157" as FiscalCode;
const anEmail = toNonEmptyString("x@example.com").get;
const anEmailNotification: INotificationChannelEmail = {
  status: NotificationChannelStatus.NOTIFICATION_QUEUED,
  toAddress: anEmail,
};

const aRetrievedProfileWithEmail: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: anEmail,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(1).get,
};

const aRetrievedProfileWithoutEmail: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(1).get,
};

const aCreatedNotificationWithEmail: INewNotification = {
  emailNotification: anEmailNotification,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "INewNotification",
  messageId: toNonEmptyString("123").get,
};

const aCreatedNotificationWithoutEmail: INewNotification = {
  emailNotification: undefined,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "INewNotification",
  messageId: toNonEmptyString("123").get,
};

function flushPromises<T>(): Promise<T> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("test index function", () => {

  it("should return failure if createdMessage is undefined", async () => {
    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        createdMessage: undefined,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    index(contextMock as any);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fatal! No valid message found in bindings.`);
  });

  it("should return failure if createdMessage is invalid (wrong fiscal code)", async () => {
    const aMessage: IRetrievedMessage = {
      _self: "",
      _ts: "",
      bodyShort: toBodyShort("xyz").get,
      fiscalCode: aWrongFiscalCode,
      id: toNonEmptyString("xyz").get,
      kind: "IRetrievedMessage",
      senderOrganizationId: "",
    };

    const aMessageEvent: ICreatedMessageEvent = {
      message: aMessage,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    index(contextMock as any);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fatal! No valid message found in bindings.`);
  });

  /*
  it("should proceed to handleMessage if createdMessage is correct", async () => {
    const aMessage: IRetrievedMessage = {
      _self: "",
      _ts: "",
      bodyShort: toBodyShort("xyz").get,
      fiscalCode: aCorrectFiscalCode,
      id: toNonEmptyString("xyz").get,
      kind: "IRetrievedMessage",
      senderOrganizationId: "",
    };

    const aMessageEvent: ICreatedMessageEvent = {
      message: aMessage,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const originalHandleMessage = handleMessage;
    handleMessage = jest.fn(() => {
      return Promise.resolve(right(none));
    });

    index(contextMock);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(handleMessage).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(contextMock.log).toHaveBeenCalledTimes(1);
    expect(contextMock.log.mock.calls[0][0]).toEqual(`A new message was created|${aMessage.id}|${aMessage.fiscalCode}`);

    handleMessage = originalHandleMessage;
  });
  */

});

describe("test handleMessage function", () => {

  it("should return TRANSIENT error if fetching user profile returns error", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(left(none));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(profileModelMock as any, {} as any, retrievedMessageMock as any);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aCorrectFiscalCode);
    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toEqual(ProcessingError.TRANSIENT);
    }
  });

  it("should return NO_PROFILE error if no profile exists for fiscal code", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(profileModelMock as any, {} as any, retrievedMessageMock as any);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aCorrectFiscalCode);
    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toEqual(ProcessingError.NO_PROFILE);
    }
  });

  it("should create a notification with undefined email if a profile exists" +
      "for fiscal code but the email field is empty", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfileWithoutEmail)));
      }),
    };

    const notificationModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(right(none));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(
        profileModelMock as any,
        notificationModelMock as any,
        retrievedMessageMock as any);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aCorrectFiscalCode);
    expect(response.isRight).toBeTruthy();
    if (response.isRight) {
      expect(response.right.emailNotification).toBe(undefined);
    }
  });

  it("should create a notification with an email if a profile exists for" +
      "fiscal code and the email field isn't empty", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfileWithEmail)));
      }),
    };

    const notificationModelMock = {
      create: jest.fn((document, _) => {
        return Promise.resolve(right(document));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(
        profileModelMock as any,
        notificationModelMock as any,
        retrievedMessageMock as any);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aCorrectFiscalCode);
    expect(response.isRight).toBeTruthy();
    if (response.isRight) {
      expect(response.right.emailNotification.toAddress).toBe(anEmail);
    }
  });

  it("should return TRANSIENT error if saving notification returns error", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfileWithEmail)));
      }),
    };

    const notificationModelMock = {
      create: jest.fn((_, __) => {
        return Promise.resolve(left(none));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(
        profileModelMock as any,
        notificationModelMock as any,
        retrievedMessageMock as any);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(aCorrectFiscalCode);
    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toEqual(ProcessingError.TRANSIENT);
    }
  });

});

describe("test processResolve function", () => {

  it("should enqueue notification to the email queue if an email is present", async () => {
    const errorOrNotificationMock = {
      isRight: () => true,
      right: aCreatedNotificationWithEmail,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    processResolve(errorOrNotificationMock as any, contextMock as any, retrievedMessageMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification.messageId).toEqual(aCreatedNotificationWithEmail.messageId);
    expect(contextMock.bindings.emailNotification.notificationId).toEqual(aCreatedNotificationWithEmail.id);
  });

  it("should not enqueue notification to the email queue if no email is present", async () => {
    const errorOrNotificationMock = {
      isRight: () => true,
      right: aCreatedNotificationWithoutEmail,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    processResolve(errorOrNotificationMock as any, contextMock as any, retrievedMessageMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

  it("should not enqueue notification on error (no profile)", async () => {
    const errorOrNotificationMock = {
      isLeft: () => true,
      left: ProcessingError.NO_PROFILE,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const retrievedMessageMock = {
      fiscalCode: aWrongFiscalCode,
    };

    processResolve(errorOrNotificationMock as any, contextMock as any, retrievedMessageMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(
        contextMock.log.error.mock.calls[0][0]).toEqual(
        `Fiscal code has no associated profile|${retrievedMessageMock.fiscalCode}`);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

  it("should not enqueue notification on error (generic)", async () => {
    const errorOrNotificationMock = {
      isLeft: () => true,
      left: ProcessingError.TRANSIENT,
    };

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const retrievedMessageMock = {
      fiscalCode: aWrongFiscalCode,
    };

    processResolve(errorOrNotificationMock as any, contextMock as any, retrievedMessageMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(
        contextMock.log.error.mock.calls[0][0]).toEqual(
        `Transient error, retrying|${retrievedMessageMock.fiscalCode}`);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

});

describe("test processReject function", () => {

  it("should log error on failure", async () => {
    const errorMock = jest.fn();

    const loggersMock = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: loggersMock,
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    processReject(contextMock as any, retrievedMessageMock as any, errorMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(
        contextMock.log.error.mock.calls[0][0]).toEqual(
        `Error while processing event, retrying|${retrievedMessageMock.fiscalCode}|${errorMock}`);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

});
