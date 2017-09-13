// tslint:disable:no-any

import {
  index, processResolve,
} from "../created_message_queue_handler";
import { ICreatedMessageEvent } from "../models/created_message_event";
import { IRetrievedMessage } from "../models/message";

import { none, some } from "ts-option";
import { toBodyShort } from "../api/definitions/BodyShort";
import { FiscalCode } from "../api/definitions/FiscalCode";
import {
  handleMessage,
  ProcessingError,
} from "../controllers/queued_message_handler";
import {
  INewNotification,
  INotificationChannelEmail, NotificationChannelStatus,
} from "../models/notification";
import { IRetrievedProfile } from "../models/profile";
import { left, right } from "../utils/either";
import { toFiscalCode } from "../utils/fiscalcode";
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

const aCreatedNotification: INewNotification = {
  emailNotification: anEmailNotification,
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
    const contextMock = {
      bindings: {
        createdMessage: undefined,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: jest.fn(),
    };
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.error = jest.fn();
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.info = jest.fn();

    index(contextMock);

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

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: jest.fn(),
    };
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.error = jest.fn();
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.info = jest.fn();

    index(contextMock);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fatal! No valid message found in bindings.`);
  });

});

describe("test handleMessage function", () => {

  it("should return TRANSIENT error if database returns error", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(left(none));
      }),
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    const response = await handleMessage(profileModelMock as any, undefined, retrievedMessageMock as any);

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

    const response = await handleMessage(profileModelMock as any, undefined, retrievedMessageMock as any);

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
      create: jest.fn((document, partitionKey) => {
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

});

describe("test processResolve function", () => {

  it("should enqueue notification", async () => {
    const errorOrNotificationMock = {
      isRight: () => true,
      right: aCreatedNotification,
    };

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

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined,
      },
      done: jest.fn(),
      log: jest.fn(),
    };
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.error = jest.fn();
    // tslint:disable-next-line:no-object-mutation
    contextMock.log.info = jest.fn();

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
    };

    processResolve(errorOrNotificationMock as any, contextMock as any, retrievedMessageMock as any);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification.messageId).toEqual(aCreatedNotification.messageId);
    expect(contextMock.bindings.emailNotification.notificationId).toEqual(aCreatedNotification.id);
  });

});
