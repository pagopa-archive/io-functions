// tslint:disable:no-any

import {
  handleMessage,
  index,
  ProcessingError,
  processReject,
  processResolve
} from "../created_message_queue_handler";
import { ICreatedMessageEvent } from "../models/created_message_event";
import {
  IMessageContent,
  IRetrievedMessageWithoutContent
} from "../models/message";

import { none, some } from "ts-option";
import { FiscalCode, toFiscalCode } from "../api/definitions/FiscalCode";
import { toMessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { NotificationChannelStatus } from "../api/definitions/NotificationChannelStatus";

import {
  INewNotification,
  INotificationChannelEmail,
  NotificationAddressSource
} from "../models/notification";
import { IRetrievedProfile } from "../models/profile";

import * as winston from "winston";
import { left, right } from "../utils/either";
import { toNonNegativeNumber } from "../utils/numbers";
import { toNonEmptyString } from "../utils/strings";

// setup jest
jest.mock("applicationinsights");
jest.useFakeTimers();

const aCorrectFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;
const aWrongFiscalCode = "FRLFRC74E04B157" as FiscalCode;
const anEmail = toNonEmptyString("x@example.com").get;
const anEmailNotification: INotificationChannelEmail = {
  addressSource: NotificationAddressSource.PROFILE_ADDRESS,
  status: NotificationChannelStatus.QUEUED,
  toAddress: anEmail
};

const aMessageBodyMarkdown = toMessageBodyMarkdown("test".repeat(80)).get;

const aRetrievedProfileWithEmail: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: anEmail,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(1).get
};

const aRetrievedProfileWithoutEmail: IRetrievedProfile = {
  _self: "123",
  _ts: "123",
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "IRetrievedProfile",
  version: toNonNegativeNumber(1).get
};

const aCreatedNotificationWithEmail: INewNotification = {
  emailNotification: anEmailNotification,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "INewNotification",
  messageId: toNonEmptyString("123").get
};

const aCreatedNotificationWithoutEmail: INewNotification = {
  emailNotification: undefined,
  fiscalCode: aCorrectFiscalCode,
  id: toNonEmptyString("123").get,
  kind: "INewNotification",
  messageId: toNonEmptyString("123").get
};

const aBlobService = {};

const anAttachmentMeta = {
  contentType: "application/json",
  media: "media.json"
};

function flushPromises<T>(): Promise<T> {
  return new Promise(resolve => setImmediate(resolve));
}

describe("test index function", () => {
  it("should return failure if createdMessage is undefined", async () => {
    const contextMock = {
      bindings: {
        createdMessage: undefined,
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const spy = jest.spyOn(winston, "error");

    index(contextMock as any);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      `Fatal! No valid message found in bindings.`
    );

    spy.mockReset();
    spy.mockRestore();
  });

  it("should return failure if createdMessage is invalid (wrong fiscal code)", async () => {
    const aMessage: IRetrievedMessageWithoutContent = {
      _self: "",
      _ts: "",
      fiscalCode: aWrongFiscalCode,
      id: toNonEmptyString("xyz").get,
      kind: "IRetrievedMessageWithoutContent",
      senderOrganizationId: "",
      senderUserId: toNonEmptyString("u123").get
    };

    const aMessageEvent: ICreatedMessageEvent = {
      message: aMessage,
      messageContent: {
        bodyMarkdown: aMessageBodyMarkdown
      }
    };

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const spy = jest.spyOn(winston, "error");

    index(contextMock as any);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      `Fatal! No valid message found in bindings.`
    );

    spy.mockReset();
    spy.mockRestore();
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

    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined,
      },
      done: jest.fn(),
    };

    const originalHandleMessage = handleMessage;
    handleMessage = jest.fn(() => {
      return Promise.resolve(right(none));
    });

    const spy = jest.spyOn(winston, "log");

    index(contextMock);

    await flushPromises();

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(handleMessage).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(`A new message was created|${aMessage.id}|${aMessage.fiscalCode}`);

    handleMessage = originalHandleMessage;

    spy.mockReset();
    spy.mockRestore();
  });
  */
});

describe("test handleMessage function", () => {
  it("should return TRANSIENT error if fetching user profile returns error", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    const response = await handleMessage(
      profileModelMock as any,
      {} as any,
      {} as any,
      {} as any,
      retrievedMessageMock as any,
      {} as any,
      none
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aCorrectFiscalCode
    );
    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toEqual(ProcessingError.TRANSIENT);
    }
  });

  it("should return NO_ADDRESSES error if no channels can be resolved", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    const response = await handleMessage(
      profileModelMock as any,
      {} as any,
      {} as any,
      {} as any,
      retrievedMessageMock as any,
      {} as any,
      none
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aCorrectFiscalCode
    );
    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toEqual(ProcessingError.NO_ADDRESSES);
    }
  });

  it(
    "should not create a notification if a profile exists " +
      "but the email field is empty and no default email was provided",
    async () => {
      const profileModelMock = {
        findOneProfileByFiscalCode: jest.fn(() => {
          return Promise.resolve(right(some(aRetrievedProfileWithoutEmail)));
        })
      };

      const notificationModelMock = {
        create: jest.fn(() => {
          return Promise.resolve(right(none));
        })
      };

      const retrievedMessageMock = {
        fiscalCode: aCorrectFiscalCode
      };

      const response = await handleMessage(
        profileModelMock as any,
        {} as any,
        notificationModelMock as any,
        {} as any,
        retrievedMessageMock as any,
        {} as any,
        none
      );

      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
        aCorrectFiscalCode
      );
      expect(response.isLeft).toBeTruthy();
      if (response.isLeft) {
        expect(response.left).toBe(ProcessingError.NO_ADDRESSES);
      }
    }
  );

  it(
    "should create a notification with an email if a profile exists for" +
      "fiscal code and the email field isn't empty",
    async () => {
      const profileModelMock = {
        findOneProfileByFiscalCode: jest.fn(() => {
          return Promise.resolve(right(some(aRetrievedProfileWithEmail)));
        })
      };

      const notificationModelMock = {
        create: jest.fn((document, _) => {
          return Promise.resolve(right(document));
        })
      };

      const retrievedMessageMock = {
        fiscalCode: aCorrectFiscalCode
      };

      const response = await handleMessage(
        profileModelMock as any,
        {} as any,
        notificationModelMock as any,
        {} as any,
        retrievedMessageMock as any,
        {} as any,
        none
      );

      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
        aCorrectFiscalCode
      );
      expect(response.isRight).toBeTruthy();
      if (response.isRight) {
        expect(response.right.emailNotification).not.toBeUndefined();
        if (response.right.emailNotification !== undefined) {
          expect(response.right.emailNotification.toAddress).toBe(anEmail);
          expect(response.right.emailNotification.addressSource).toBe(
            NotificationAddressSource.PROFILE_ADDRESS
          );
        }
      }
    }
  );

  it(
    "should create a notification with an email if a profile exists for" +
      "fiscal code, the email field is empty but a default email was provided",
    async () => {
      const profileModelMock = {
        findOneProfileByFiscalCode: jest.fn(() => {
          return Promise.resolve(
            right(
              some({
                ...aRetrievedProfileWithEmail,
                email: undefined
              })
            )
          );
        })
      };

      const notificationModelMock = {
        create: jest.fn((document, _) => {
          return Promise.resolve(right(document));
        })
      };

      const retrievedMessageMock = {
        fiscalCode: aCorrectFiscalCode
      };

      const response = await handleMessage(
        profileModelMock as any,
        {} as any,
        notificationModelMock as any,
        {} as any,
        retrievedMessageMock as any,
        {} as any,
        some({
          email: anEmail
        })
      );

      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
        aCorrectFiscalCode
      );
      expect(response.isRight).toBeTruthy();
      if (response.isRight) {
        expect(response.right.emailNotification).not.toBeUndefined();
        if (response.right.emailNotification !== undefined) {
          expect(response.right.emailNotification.toAddress).toBe(anEmail);
          expect(response.right.emailNotification.addressSource).toBe(
            NotificationAddressSource.DEFAULT_ADDRESS
          );
        }
      }
    }
  );

  it(
    "should create a notification with an email if a profile does not exists for" +
      "fiscal code but a default email was provided",
    async () => {
      const profileModelMock = {
        findOneProfileByFiscalCode: jest.fn(() => {
          return Promise.resolve(right(none));
        })
      };

      const notificationModelMock = {
        create: jest.fn((document, _) => {
          return Promise.resolve(right(document));
        })
      };

      const retrievedMessageMock = {
        fiscalCode: aCorrectFiscalCode
      };

      const response = await handleMessage(
        profileModelMock as any,
        {} as any,
        notificationModelMock as any,
        {} as any,
        retrievedMessageMock as any,
        {} as any,
        some({
          email: anEmail
        })
      );

      expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
        aCorrectFiscalCode
      );
      expect(response.isRight).toBeTruthy();
      if (response.isRight) {
        expect(response.right.emailNotification).not.toBeUndefined();
        if (response.right.emailNotification !== undefined) {
          expect(response.right.emailNotification.toAddress).toBe(anEmail);
          expect(response.right.emailNotification.addressSource).toBe(
            NotificationAddressSource.DEFAULT_ADDRESS
          );
        }
      }
    }
  );

  it("should save the message content if the user enabled the feature in its profile", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(
          right(
            some({
              ...aRetrievedProfileWithEmail,
              isStorageOfMessageContentEnabled: true
            })
          )
        );
      })
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
      id: "A_MESSAGE_ID"
    };

    const messageModelMock = {
      attachStoredContent: jest.fn(() => {
        return Promise.resolve(right(some(anAttachmentMeta)));
      })
    };

    const notificationModelMock = {
      create: jest.fn((document, _) => {
        return Promise.resolve(right(document));
      })
    };

    const messageContent: IMessageContent = {
      bodyMarkdown: aMessageBodyMarkdown
    };

    const response = await handleMessage(
      profileModelMock as any,
      messageModelMock as any,
      notificationModelMock as any,
      aBlobService as any,
      retrievedMessageMock as any,
      messageContent,
      some({
        email: anEmail
      })
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aCorrectFiscalCode
    );

    expect(messageModelMock.attachStoredContent.mock.calls[0][0]).toBe(
      aBlobService
    );
    expect(messageModelMock.attachStoredContent.mock.calls[0][1]).toBe(
      retrievedMessageMock.id
    );
    expect(messageModelMock.attachStoredContent.mock.calls[0][2]).toEqual(
      retrievedMessageMock.fiscalCode
    );

    expect(response.isRight).toBeTruthy();
    if (response.isRight) {
      expect(response.right.emailNotification).not.toBeUndefined();
      if (response.right.emailNotification !== undefined) {
        expect(response.right.emailNotification.toAddress).toBe(anEmail);
        expect(response.right.emailNotification.addressSource).toBe(
          NotificationAddressSource.PROFILE_ADDRESS
        );
      }
    }
  });

  it("should return a TRANSIENT error if saving the message content errors", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(
          right(
            some({
              ...aRetrievedProfileWithEmail,
              isStorageOfMessageContentEnabled: true
            })
          )
        );
      })
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode,
      id: "A_MESSAGE_ID"
    };

    const messageModelMock = {
      attachStoredContent: jest.fn(() => {
        return Promise.resolve(left("error"));
      })
    };

    const notificationModelMock = {
      create: jest.fn((document, _) => {
        return Promise.resolve(right(document));
      })
    };

    const messageContent: IMessageContent = {
      bodyMarkdown: aMessageBodyMarkdown
    };

    const response = await handleMessage(
      profileModelMock as any,
      messageModelMock as any,
      notificationModelMock as any,
      aBlobService as any,
      retrievedMessageMock as any,
      messageContent,
      some({
        email: anEmail
      })
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aCorrectFiscalCode
    );

    expect(messageModelMock.attachStoredContent.mock.calls[0][0]).toBe(
      aBlobService
    );
    expect(messageModelMock.attachStoredContent.mock.calls[0][1]).toBe(
      retrievedMessageMock.id
    );
    expect(messageModelMock.attachStoredContent.mock.calls[0][2]).toEqual(
      retrievedMessageMock.fiscalCode
    );

    expect(response.isLeft).toBeTruthy();
    if (response.isLeft) {
      expect(response.left).toBe(ProcessingError.TRANSIENT);
    }
  });

  it("should return TRANSIENT error if saving notification returns error", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfileWithEmail)));
      })
    };

    const notificationModelMock = {
      create: jest.fn((_, __) => {
        return Promise.resolve(left(none));
      })
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    const response = await handleMessage(
      profileModelMock as any,
      {} as any,
      notificationModelMock as any,
      {} as any,
      retrievedMessageMock as any,
      {} as any,
      none
    );

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aCorrectFiscalCode
    );
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
      right: aCreatedNotificationWithEmail
    };

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    processResolve(
      errorOrNotificationMock as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      {} as any
    );

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings).not.toBeUndefined();
    const emailNotification = (contextMock.bindings as any).emailNotification;
    expect(emailNotification).not.toBeUndefined();
    if (emailNotification !== undefined) {
      expect(emailNotification.messageId).toEqual(
        aCreatedNotificationWithEmail.messageId
      );
      expect(emailNotification.notificationId).toEqual(
        aCreatedNotificationWithEmail.id
      );
    }
  });

  it("should not enqueue notification to the email queue if no email is present", async () => {
    const errorOrNotificationMock = {
      isRight: () => true,
      right: aCreatedNotificationWithoutEmail
    };

    const contextMock = {
      bindings: {
        emailNotification: undefined
      },
      done: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    processResolve(
      errorOrNotificationMock as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      {} as any
    );

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

  it("should not enqueue email notification on error (no profile and no default email)", async () => {
    const errorOrNotificationMock = {
      isLeft: () => true,
      left: ProcessingError.NO_ADDRESSES
    };

    const contextMock = {
      bindingData: { dequeueCount: 5 },
      bindings: {
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aWrongFiscalCode
    };

    const spy = jest.spyOn(winston, "error");

    processResolve(
      errorOrNotificationMock as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      {} as any
    );

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      `Fiscal code has no associated profile and no default addresses provided|${retrievedMessageMock.fiscalCode}`
    );
    expect(contextMock.bindings.emailNotification).toEqual(undefined);

    spy.mockReset();
    spy.mockRestore();
  });

  it("should not enqueue notification on error (generic)", async () => {
    const errorOrNotificationMock = {
      isLeft: () => true,
      left: ProcessingError.TRANSIENT
    };

    const contextMock = {
      bindingData: { dequeueCount: 5 },
      bindings: {
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aWrongFiscalCode
    };

    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    const spy = jest.spyOn(winston, "error");

    processResolve(
      errorOrNotificationMock as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      mockAppinsights as any
    );
    jest.runAllTimers();

    expect(mockAppinsights.trackEvent).toHaveBeenCalled();
    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      `Transient error, retrying|${retrievedMessageMock.fiscalCode}`
    );
    expect(contextMock.bindings.emailNotification).toEqual(undefined);

    spy.mockReset();
    spy.mockRestore();
  });
});

describe("test processReject function", () => {
  it("should log error on failure", async () => {
    const errorMock = jest.fn();

    const contextMock = {
      bindingData: { dequeueCount: 5 },
      bindings: {
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    const spy = jest.spyOn(winston, "error");

    const mockAppinsights = {
      trackEvent: jest.fn()
    };

    processReject(
      contextMock as any,
      retrievedMessageMock as any,
      errorMock as any,
      mockAppinsights as any
    );
    jest.runAllTimers();

    expect(mockAppinsights.trackEvent).toHaveBeenCalled();
    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      `Error while processing event, retrying|${retrievedMessageMock.fiscalCode}|${errorMock}`
    );
    expect(contextMock.bindings.emailNotification).toEqual(undefined);

    spy.mockReset();
    spy.mockRestore();
  });
});
