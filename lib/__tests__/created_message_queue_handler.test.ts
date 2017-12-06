// tslint:disable:no-any
import { MessageContent } from "../api/definitions/MessageContent";

// set a dummy value for the env vars needed by the handler
// tslint:disable-next-line:no-object-mutation
process.env.CUSTOMCONNSTR_COSMOSDB_URI = "anyCosmosDbUri";
// tslint:disable-next-line:no-object-mutation
process.env.CUSTOMCONNSTR_COSMOSDB_KEY = "anyCosmosDbKey";
// tslint:disable-next-line:no-object-mutation
process.env.COSMOSDB_NAME = "anyDbName";
// tslint:disable-next-line:no-object-mutation
process.env.MESSAGE_CONTAINER_NAME = "anyMessageContainerName";
// tslint:disable-next-line:no-object-mutation
process.env.AzureWebJobsStorage = "anyAzureWebJobsStorage";

import * as t from "io-ts";

import {
  handleMessage,
  index,
  ProcessingError,
  processReject,
  processResolve
} from "../created_message_queue_handler";
import { CreatedMessageEvent } from "../models/created_message_event";
import { NewMessageWithoutContent } from "../models/message";

import { none, Option, some, Some } from "fp-ts/lib/Option";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";
import { NotificationChannelStatusEnum } from "../api/definitions/NotificationChannelStatus";

import {
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationChannelEmail
} from "../models/notification";
import { RetrievedProfile } from "../models/profile";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import * as winston from "winston";
import { NonNegativeNumber } from "../utils/numbers";
import { EmailString, NonEmptyString } from "../utils/strings";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

const aCorrectFiscalCode = _getO(
  t.validate("FRLFRC74E04B157I", FiscalCode).toOption()
);
const aWrongFiscalCode = "FRLFRC74E04B157" as FiscalCode;
const anEmail = _getO(t.validate("x@example.com", EmailString).toOption());
const anEmailNotification: NotificationChannelEmail = {
  addressSource: NotificationAddressSourceEnum.PROFILE_ADDRESS,
  status: NotificationChannelStatusEnum.QUEUED,
  toAddress: anEmail
};

const aMessageBodyMarkdown = _getO(
  t.validate("test".repeat(80), MessageBodyMarkdown).toOption()
);

const aRetrievedProfileWithEmail: RetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: anEmail,
  fiscalCode: aCorrectFiscalCode,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  kind: "IRetrievedProfile",
  version: _getO(t.validate(1, NonNegativeNumber).toOption())
};

const aRetrievedProfileWithoutEmail: RetrievedProfile = {
  _self: "123",
  _ts: "123",
  fiscalCode: aCorrectFiscalCode,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  kind: "IRetrievedProfile",
  version: _getO(t.validate(1, NonNegativeNumber).toOption())
};

const aCreatedNotificationWithEmail: NewNotification = {
  emailNotification: anEmailNotification,
  fiscalCode: aCorrectFiscalCode,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  kind: "INewNotification",
  messageId: _getO(t.validate("123", NonEmptyString).toOption())
};

const aCreatedNotificationWithoutEmail: NewNotification = {
  emailNotification: undefined,
  fiscalCode: aCorrectFiscalCode,
  id: _getO(t.validate("123", NonEmptyString).toOption()),
  kind: "INewNotification",
  messageId: _getO(t.validate("123", NonEmptyString).toOption())
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
    const aMessage: NewMessageWithoutContent = {
      fiscalCode: aWrongFiscalCode,
      id: _getO(t.validate("xyz", NonEmptyString).toOption()),
      kind: "INewMessageWithoutContent",
      senderServiceId: "",
      senderUserId: _getO(t.validate("u123", NonEmptyString).toOption())
    };

    const aMessageEvent: CreatedMessageEvent = {
      message: aMessage,
      messageContent: {
        markdown: aMessageBodyMarkdown
      },
      senderMetadata: {
        departmentName: _getO(t.validate("IT", NonEmptyString).toOption()),
        organizationName: _getO(t.validate("agid", NonEmptyString).toOption()),
        serviceName: _getO(t.validate("Test", NonEmptyString).toOption())
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
    const aMessage: RetrievedMessage = {
      _self: "",
      _ts: "",
      bodyShort: _getO(toBodyShort("xyz")),
      fiscalCode: aCorrectFiscalCode,
      id: _getO(t.validate("xyz", NonEmptyString).toOption()),
      kind: "RetrievedMessage",
      senderServiceId: "",
    };

    const aMessageEvent: CreatedMessageEvent = {
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
    expect(isLeft(response)).toBeTruthy();
    expect(response.value).toEqual(ProcessingError.TRANSIENT);
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
    expect(isLeft(response)).toBeTruthy();
    expect(response.value).toEqual(ProcessingError.NO_ADDRESSES);
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
      expect(isLeft(response)).toBeTruthy();
      expect(response.value).toBe(ProcessingError.NO_ADDRESSES);
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
      expect(isRight(response)).toBeTruthy();
      if (isRight(response)) {
        expect(response.value.emailNotification).not.toBeUndefined();
        if (response.value.emailNotification !== undefined) {
          expect(response.value.emailNotification.toAddress).toBe(anEmail);
          expect(response.value.emailNotification.addressSource).toBe(
            NotificationAddressSourceEnum.PROFILE_ADDRESS
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
      expect(isRight(response)).toBeTruthy();
      if (isRight(response)) {
        expect(response.value.emailNotification).not.toBeUndefined();
        if (response.value.emailNotification !== undefined) {
          expect(response.value.emailNotification.toAddress).toBe(anEmail);
          expect(response.value.emailNotification.addressSource).toBe(
            NotificationAddressSourceEnum.DEFAULT_ADDRESS
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
      expect(isRight(response)).toBeTruthy();
      if (isRight(response)) {
        expect(response.value.emailNotification).not.toBeUndefined();
        if (response.value.emailNotification !== undefined) {
          expect(response.value.emailNotification.toAddress).toBe(anEmail);
          expect(response.value.emailNotification.addressSource).toBe(
            NotificationAddressSourceEnum.DEFAULT_ADDRESS
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

    const messageContent: MessageContent = {
      markdown: aMessageBodyMarkdown
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

    expect(isRight(response)).toBeTruthy();
    if (isRight(response)) {
      expect(response.value.emailNotification).not.toBeUndefined();
      if (response.value.emailNotification !== undefined) {
        expect(response.value.emailNotification.toAddress).toBe(anEmail);
        expect(response.value.emailNotification.addressSource).toBe(
          NotificationAddressSourceEnum.PROFILE_ADDRESS
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

    const messageContent: MessageContent = {
      markdown: aMessageBodyMarkdown
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

    expect(isLeft(response)).toBeTruthy();
    expect(response.value).toBe(ProcessingError.TRANSIENT);
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
    expect(isLeft(response)).toBeTruthy();
    expect(response.value).toEqual(ProcessingError.TRANSIENT);
  });
});

describe("test processResolve function", () => {
  it("should enqueue notification to the email queue if an email is present", async () => {
    const errorOrNotification = right(aCreatedNotificationWithEmail);

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    const retrievedMessageMock = {
      fiscalCode: aCorrectFiscalCode
    };

    processResolve(
      errorOrNotification as any,
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
    const errorOrNotification = right(aCreatedNotificationWithoutEmail);

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
      errorOrNotification as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      {} as any
    );

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);
  });

  it("should not enqueue email notification on error (no profile and no default email)", async () => {
    const errorOrNotification = left(ProcessingError.NO_ADDRESSES);

    const contextMock = {
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
      errorOrNotification as any,
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
    const errorOrNotification = left(ProcessingError.TRANSIENT);

    const contextMock = {
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
      errorOrNotification as any,
      contextMock as any,
      retrievedMessageMock as any,
      {} as any,
      {} as any
    );

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

    processReject(
      contextMock as any,
      retrievedMessageMock as any,
      errorMock as any
    );

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
