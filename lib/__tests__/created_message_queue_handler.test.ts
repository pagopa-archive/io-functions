/* tslint:disable:no-any */
/* tslint:disable:no-big-function */
/* tslint:disable:no-identical-functions */

// set a dummy value for the env vars needed by the handler
// tslint:disable-next-line:no-object-mutation
process.env = {
  ...process.env,
  COSMOSDB_NAME: "anyDbName",
  CUSTOMCONNSTR_COSMOSDB_KEY: "anyCosmosDbKey",
  CUSTOMCONNSTR_COSMOSDB_URI: "anyCosmosDbUri",
  MESSAGE_CONTAINER_NAME: "anyMessageContainerName",
  QueueStorageConnection: "anyQueueStorageConnection"
};

import { CreatedMessageEvent } from "../models/created_message_event";
import { NewMessageWithContent } from "../models/message";

import * as functionConfig from "../../CreatedMessageQueueHandler/function.json";

import { none, some } from "fp-ts/lib/Option";
import { FiscalCode } from "../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../api/definitions/MessageBodyMarkdown";

import {
  EmailNotification,
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationModel
} from "../models/notification";
import { ProfileModel, RetrievedProfile } from "../models/profile";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import * as winston from "winston";
import { isTransient, PermanentError, TransientError } from "../utils/errors";
import { NonNegativeNumber } from "../utils/numbers";
import { EmailString, NonEmptyString } from "../utils/strings";

import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { TimeToLiveSeconds } from "../api/definitions/TimeToLiveSeconds";
import { NotificationEvent } from "../models/notification_event";

jest.mock("azure-storage");
jest.mock("../utils/azure_queues");
import { updateMessageVisibilityTimeout } from "../utils/azure_queues";

import { MessageStatusValueEnum } from "../api/definitions/MessageStatusValue";
import {
  handleMessage,
  index,
  MESSAGE_QUEUE_NAME,
  processRuntimeError
} from "../created_message_queue_handler";

import { MessageStatusModel } from "../models/message_status";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

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

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessage: NewMessageWithContent = {
  content: {
    markdown: aMessageBodyMarkdown
  },
  createdAt: new Date(),
  fiscalCode: aCorrectFiscalCode,
  id: "xyz" as NonEmptyString,
  kind: "INewMessageWithContent",
  senderServiceId: "",
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aMessageEvent: CreatedMessageEvent = {
  message: aMessage,
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
  message: {
    ...aMessage,
    content: { markdown: aMessageBodyMarkdown },
    kind: "INewMessageWithContent"
  },
  notificationId: aCreatedNotificationWithEmail.id,
  senderMetadata: aMessageEvent.senderMetadata
};

const aBlobService = {};

const anAttachmentMeta = {
  contentType: "application/json",
  media: "media.json"
};

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

    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should return failure if any error occurs", async () => {
    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    jest
      .spyOn(ProfileModel.prototype, "findOneProfileByFiscalCode")
      .mockImplementationOnce(() => {
        throw new Error("findOneProfileByFiscalCodeErr");
      });

    const messageStatusSpy = jest
      .spyOn(MessageStatusModel.prototype, "upsert")
      .mockReturnValue(Promise.resolve(right(none)));
    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(messageStatusSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MessageStatusValueEnum.FAILED
      }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("should stop processing if createdMessage is invalid (wrong fiscal code)", async () => {
    const contextMock = {
      bindings: {
        createdMessage: {
          aMessageEvent,
          message: { ...aMessage, fiscalCode: aWrongFiscalCode }
        },
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const spy = jest.spyOn(winston, "error");

    const ret = await index(contextMock as any);
    expect(ret).toEqual(undefined);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should output bindings on success", async () => {
    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const notificationSpy = jest
      .spyOn(NotificationModel.prototype, "create")
      .mockImplementationOnce(() =>
        Promise.resolve(right(aCreatedNotificationWithEmail))
      );

    jest
      .spyOn(MessageStatusModel.prototype, "upsert")
      .mockReturnValue(Promise.resolve(right(none)));

    const profileSpy = jest
      .spyOn(ProfileModel.prototype, "findOneProfileByFiscalCode")
      .mockImplementationOnce(() =>
        Promise.resolve(right(some(aRetrievedProfileWithEmail)))
      );

    const ret = await index(contextMock as any);
    expect(ret).toEqual({
      emailNotification: anEmailNotificationEvent
    });

    expect(profileSpy).toHaveBeenCalledTimes(1);
    expect(notificationSpy).toHaveBeenCalledTimes(1);
  });

  it("should trigger a retry in case of transient errors", async () => {
    const contextMock = {
      bindings: {
        createdMessage: aMessageEvent,
        emailNotification: undefined
      },
      done: jest.fn(),
      log: jest.fn()
    };

    const profileSpy = jest
      .spyOn(ProfileModel.prototype, "findOneProfileByFiscalCode")
      .mockImplementationOnce(() => Promise.resolve(left(none)));

    (updateMessageVisibilityTimeout as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(true)
    );
    expect.assertions(2);
    try {
      await index(contextMock as any);
    } catch (e) {
      expect(e.kind).toEqual("TransientError");
      expect(profileSpy).toHaveBeenCalledTimes(1);
    }
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

    const response = await handleMessage(
      profileModelMock as any,
      messageModelMock as any,
      notificationModelMock as any,
      aBlobService as any,
      retrievedMessageMock as any,
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

    const response = await handleMessage(
      profileModelMock as any,
      messageModelMock as any,
      notificationModelMock as any,
      aBlobService as any,
      retrievedMessageMock as any,
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

describe("processRuntimeError", () => {
  it("should retry on errors during status update", async () => {
    const error = PermanentError("err");
    const winstonSpy = jest.spyOn(winston, "warn");
    const messageStatusUpdaterMock = jest
      .fn()
      .mockReturnValue(left(TransientError("err")));
    await processRuntimeError(
      {} as any,
      messageStatusUpdaterMock,
      error as any,
      {} as any
    );
    expect(messageStatusUpdaterMock).toHaveBeenCalledWith(
      MessageStatusValueEnum.FAILED
    );
    expect(updateMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    expect(winstonSpy).toHaveBeenCalledTimes(2);
  });

  it("should retry on transient error", async () => {
    const error = TransientError("err");
    const winstonSpy = jest.spyOn(winston, "warn");
    const messageStatusUpdaterMock = jest.fn().mockReturnValue(right(none));
    await processRuntimeError(
      {} as any,
      messageStatusUpdaterMock,
      {} as any,
      error as any
    );
    expect(messageStatusUpdaterMock).toHaveBeenCalledWith(
      MessageStatusValueEnum.THROTTLED
    );
    expect(updateMessageVisibilityTimeout).toHaveBeenCalledTimes(1);
    expect(winstonSpy).toHaveBeenCalledTimes(1);
  });

  it("should fail in case of permament error", async () => {
    const error = PermanentError("err");
    const winstonSpy = jest.spyOn(winston, "error");
    const messageStatusUpdaterMock = jest.fn().mockReturnValue(right(none));
    await processRuntimeError(
      {} as any,
      messageStatusUpdaterMock,
      {} as any,
      error as any
    );
    expect(messageStatusUpdaterMock).toHaveBeenCalledWith(
      MessageStatusValueEnum.FAILED
    );
    expect(updateMessageVisibilityTimeout).not.toHaveBeenCalled();
    expect(winstonSpy).toHaveBeenCalledTimes(1);
  });
});

describe("createMessageQueueHandler", () => {
  it("should set MESSAGE_QUEUE_NAME = queueName in functions.json trigger", async () => {
    const queueName = (functionConfig as any).bindings[0].queueName;
    expect(queueName).toEqual(MESSAGE_QUEUE_NAME);
  });
});
