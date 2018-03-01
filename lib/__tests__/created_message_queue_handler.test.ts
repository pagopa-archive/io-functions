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
process.env.QueueStorageConnection = "anyQueueStorageConnection";

import {
  handleMessage,
  index,
  MESSAGE_QUEUE_NAME,
  processResolve
} from "../created_message_queue_handler";
import { CreatedMessageEvent } from "../models/created_message_event";
import { NewMessageWithoutContent } from "../models/message";

import * as functionConfig from "../../CreatedMessageQueueHandler/function.json";

import { none, some } from "fp-ts/lib/Option";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";

import {
  EmailNotification,
  NewNotification,
  NotificationAddressSourceEnum
} from "../models/notification";
import { RetrievedProfile } from "../models/profile";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import * as winston from "winston";
import { isTransient, PermanentError, TransientError } from "../utils/errors";
import { NonNegativeNumber } from "../utils/numbers";
import { EmailString, NonEmptyString } from "../utils/strings";

jest.mock("azure-storage");
jest.mock("../utils/azure_queues");
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { NotificationEvent } from "../models/notification_event";
import { retryMessageEnqueue } from "../utils/azure_queues";

const aCorrectFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aWrongFiscalCode = "FRLFRC74E04B157" as FiscalCode;
const anEmail = "x@example.com" as EmailString;

const anEmailNotification: EmailNotification = {
  channels: {
    [NotificationChannelEnum.EMAIL]: {
      addressSource: NotificationAddressSourceEnum.PROFILE_ADDRESS,
      fromAddress: anEmail,
      toAddress: anEmail
    }
  },
  fiscalCode: aCorrectFiscalCode,
  messageId: "m123" as NonEmptyString
};

const aMessage: NewMessageWithoutContent = {
  fiscalCode: aWrongFiscalCode,
  id: "xyz" as NonEmptyString,
  kind: "INewMessageWithoutContent",
  senderServiceId: "",
  senderUserId: "u123" as NonEmptyString
};

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageEvent: CreatedMessageEvent = {
  message: aMessage,
  messageContent: {
    markdown: aMessageBodyMarkdown
  },
  senderMetadata: {
    departmentName: "IT" as NonEmptyString,
    organizationName: "agid" as NonEmptyString,
    serviceName: "Test" as NonEmptyString
  }
};

const aRetrievedProfileWithEmail: RetrievedProfile = {
  _self: "123",
  _ts: "123",
  email: anEmail,
  fiscalCode: aCorrectFiscalCode,
  id: "123" as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
};

const aRetrievedProfileWithoutEmail: RetrievedProfile = {
  _self: "123",
  _ts: "123",
  fiscalCode: aCorrectFiscalCode,
  id: "123" as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
};

const aCreatedNotificationWithoutEmail = {
  fiscalCode: aCorrectFiscalCode,
  id: "123" as NonEmptyString,
  kind: "INewNotification",
  messageId: "123" as NonEmptyString
};

const aCreatedNotificationWithEmail: NewNotification = {
  ...aCreatedNotificationWithoutEmail,
  ...anEmailNotification,
  kind: "INewNotification"
};

const anEmailNotificationEvent: NotificationEvent = {
  messageContent: aMessageEvent.messageContent,
  messageId: aCreatedNotificationWithEmail.messageId,
  notificationId: aCreatedNotificationWithEmail.id,
  senderMetadata: aMessageEvent.senderMetadata
};

const aBlobService = {};

const anAttachmentMeta = {
  contentType: "application/json",
  media: "media.json"
};

function flushPromises<T>(): Promise<T> {
  return new Promise(resolve => setImmediate(resolve));
}

describe("createdMessageQueueIndex", () => {
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

    spy.mockReset();
    spy.mockRestore();
  });

  it("should return failure if createdMessage is invalid (wrong fiscal code)", async () => {
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
    expect(contextMock.done).toHaveBeenCalledWith();
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockReset();
    spy.mockRestore();
  });
});

describe("handleMessage", () => {
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
    if (isLeft(response)) {
      expect(isTransient(response.value)).toBeTruthy();
    }
  });

  it("should fail with a permanent error if no channels can be resolved", async () => {
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
    if (isLeft(response)) {
      expect(isTransient(response.value)).toBeFalsy();
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
      expect(isLeft(response)).toBeTruthy();
      if (isLeft(response)) {
        expect(isTransient(response.value)).toBeFalsy();
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
      expect(isRight(response)).toBeTruthy();
      if (isRight(response)) {
        expect(response.value).not.toBeUndefined();
        expect(response.value.channels.EMAIL).not.toBeUndefined();
        if (
          response.value !== undefined &&
          response.value.channels.EMAIL !== undefined
        ) {
          expect(response.value.channels.EMAIL.toAddress).toBe(anEmail);
          expect(response.value.channels.EMAIL.addressSource).toBe(
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
        expect(response.value).not.toBeUndefined();
        expect(response.value.channels.EMAIL).not.toBeUndefined();
        if (
          response.value !== undefined &&
          response.value.channels.EMAIL !== undefined
        ) {
          expect(response.value.channels.EMAIL.toAddress).toBe(anEmail);
          expect(response.value.channels.EMAIL.addressSource).toBe(
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
        expect(response.value).not.toBeUndefined();
        expect(response.value.channels.EMAIL).not.toBeUndefined();
        if (
          response.value !== undefined &&
          response.value.channels.EMAIL !== undefined
        ) {
          expect(response.value.channels.EMAIL.toAddress).toBe(anEmail);
          expect(response.value.channels.EMAIL.addressSource).toBe(
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
              isInboxEnabled: true
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
      expect(response.value).not.toBeUndefined();
      expect(response.value.channels.EMAIL).not.toBeUndefined();
      if (
        response.value !== undefined &&
        response.value.channels.EMAIL !== undefined
      ) {
        expect(response.value.channels.EMAIL.toAddress).toBe(anEmail);
        expect(response.value.channels.EMAIL.addressSource).toBe(
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
              isInboxEnabled: true
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
    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(isTransient(response.value)).toBeTruthy();
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
    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(isTransient(response.value)).toBeTruthy();
    }
  });
});

describe("processResolve", () => {
  it("should enqueue notification to the email queue if an email is present", async () => {
    const errorOrNotification = right(aCreatedNotificationWithEmail);

    const contextMock = {
      bindings: {},
      done: jest.fn()
    };

    processResolve(
      errorOrNotification as any,
      contextMock as any,
      aMessageEvent.messageContent,
      aMessageEvent.senderMetadata
    );

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.done).toHaveBeenCalledWith(undefined, {
      emailNotification: anEmailNotificationEvent
    });
  });

  it("should retry on transient error", async () => {
    const errorOrNotification = left(TransientError("err"));

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
      {} as any
    );

    expect(retryMessageEnqueue).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);

    spy.mockReset();
    spy.mockRestore();
    jest.clearAllMocks();
  });
  it("should fail in case of permament error", async () => {
    const errorOrNotification = left(PermanentError("err"));

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
      {} as any
    );

    expect(retryMessageEnqueue).not.toHaveBeenCalled();
    expect(contextMock.done).toHaveBeenCalledWith();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(contextMock.bindings.emailNotification).toEqual(undefined);

    spy.mockReset();
    spy.mockRestore();
  });
});

describe("createMessageQueueHandler", () => {
  it("should set MESSAGE_QUEUE_NAME = queueName in functions.json trigger", async () => {
    const queueName = (functionConfig as any).bindings[0].queueName;
    expect(queueName).toEqual(MESSAGE_QUEUE_NAME);
  });
});
