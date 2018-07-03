/* tslint:disable:no-any */
/* tslint:disable:no-duplicate-string */
/* tslint:disable:no-big-function */

import { toAuthorizedCIDRs } from "../../models/service";

import { response as MockResponse } from "jest-mock-express";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";

import { CreatedMessageWithoutContent } from "../../api/definitions/CreatedMessageWithoutContent";
import { EmailAddress } from "../../api/definitions/EmailAddress";
import { FiscalCode } from "../../api/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";
import { MessageSubject } from "../../api/definitions/MessageSubject";

import {
  EmailString,
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";
import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { IAzureUserAttributes } from "../../utils/middlewares/azure_user_attributes";

import { QueryError } from "documentdb";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { MessageContent } from "../../api/definitions/MessageContent";
import { MessageResponseWithoutContent } from "../../api/definitions/MessageResponseWithoutContent";
import { MessageStatusValueEnum } from "../../api/definitions/MessageStatusValue";
import { NotificationChannelEnum } from "../../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../../api/definitions/NotificationChannelStatusValue";
import { TimeToLiveSeconds } from "../../api/definitions/TimeToLiveSeconds";
import {
  NewMessage,
  NewMessageWithContent,
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "../../models/message";
import { MessageStatus } from "../../models/message_status";
import {
  NotificationAddressSourceEnum,
  RetrievedNotification
} from "../../models/notification";
import {
  makeStatusId,
  RetrievedNotificationStatus
} from "../../models/notification_status";
import {
  ApiNewMessageWithDefaults,
  CreateMessage,
  CreateMessageHandler,
  GetMessageHandler,
  GetMessagesHandler,
  MessagePayloadMiddleware
} from "../messages";

import * as lolex from "lolex";
import { MaxAllowedPaymentAmount } from "../../api/definitions/MaxAllowedPaymentAmount";
import { ServiceId } from "../../api/definitions/ServiceId";

jest.mock("applicationinsights");

// mock time (ie. created_at)
const clock = lolex.install();
afterAll(() => clock.uninstall());

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const trackEventMock = jest.fn();

const getCustomTelemetryClient = () => ({
  trackEvent: trackEventMock
});

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const anEmail = "test@example.com" as EmailString;
const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const someUserAttributes: IAzureUserAttributes = {
  email: anEmail,
  kind: "IAzureUserAttributes",
  service: {
    authorizedCIDRs: toAuthorizedCIDRs([]),
    authorizedRecipients: new Set([]),
    departmentName: "IT" as NonEmptyString,
    maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
    organizationFiscalCode: anOrganizationFiscalCode,
    organizationName: "AgID" as NonEmptyString,
    serviceId: "test" as NonEmptyString,
    serviceName: "Test" as NonEmptyString
  }
};

const aUserAuthenticationDeveloper: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: "s123" as NonEmptyString,
  userId: "u123" as NonEmptyString
};

const aUserAuthenticationTrustedApplication: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList]),
  kind: "IAzureApiAuthorization",
  subscriptionId: "s123" as NonEmptyString,
  userId: "u123" as NonEmptyString
};

const aMessageSubject = "test".repeat(10) as MessageSubject;

const aMessagePayload: ApiNewMessageWithDefaults = {
  content: {
    markdown: aMessageBodyMarkdown,
    subject: aMessageSubject
  },
  time_to_live: 3600 as TimeToLiveSeconds
};

const aCustomSubject = "A custom subject" as MessageSubject;

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _self: "xyz",
  _ts: 1,
  kind: "IRetrievedMessageWithoutContent"
};

const aPublicExtendedMessage: CreatedMessageWithoutContent = {
  created_at: new Date(),
  fiscal_code: aNewMessageWithoutContent.fiscalCode,
  id: "A_MESSAGE_ID",
  sender_service_id: aNewMessageWithoutContent.senderServiceId
};

const aPublicExtendedMessageResponse: MessageResponseWithoutContent = {
  message: aPublicExtendedMessage,
  notification: {
    email: NotificationChannelStatusValueEnum.SENT,
    webhook: NotificationChannelStatusValueEnum.SENT
  },
  status: MessageStatusValueEnum.ACCEPTED
};

function getNotificationModelMock(
  aRetrievedNotification: any = { data: "data" }
): any {
  return {
    findNotificationForMessage: jest.fn(() =>
      Promise.resolve(right(some(aRetrievedNotification)))
    )
  };
}

const aRetrievedNotificationStatus: RetrievedNotificationStatus = {
  _self: "xyz",
  _ts: 123,
  channel: NotificationChannelEnum.EMAIL,
  id: "1" as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  messageId: "1" as NonEmptyString,
  notificationId: "1" as NonEmptyString,
  status: NotificationChannelStatusValueEnum.SENT,
  statusId: makeStatusId("1" as NonEmptyString, NotificationChannelEnum.EMAIL),
  updatedAt: new Date(),
  version: 1 as NonNegativeNumber
};

const aMessageStatus: MessageStatus = {
  messageId: aMessageId,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date()
};

function getNotificationStatusModelMock(
  retrievedNotificationStatus: any = right(some(aRetrievedNotificationStatus))
): any {
  return {
    findOneNotificationStatusByNotificationChannel: jest.fn(() =>
      Promise.resolve(retrievedNotificationStatus)
    )
  };
}

function getMessageStatusModelMock(
  s: Either<QueryError, Option<MessageStatus>> = right(some(aMessageStatus))
): any {
  return {
    findOneByMessageId: jest.fn().mockReturnValue(Promise.resolve(s)),
    upsert: jest.fn(status => Promise.resolve(left(status)))
  };
}

describe("CreateMessageHandler", () => {
  it("should not authorize sending messages to unauthorized recipients", async () => {
    const mockMessageModel = {
      create: jest.fn()
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      {} as any
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiLimitedMessageWrite])
      },
      undefined as any, // not used
      { ...someUserAttributes },
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();
    expect(result.kind).toBe(
      "IResponseErrorForbiddenNotAuthorizedForRecipient"
    );
  });

  it("should create a new message", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiMessageWrite])
      },
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument = mockMessageModel.create.mock.calls[0][0];
    expect(NewMessage.is(messageDocument)).toBeTruthy();
    expect(NewMessageWithContent.is(messageDocument.content)).toBeFalsy();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: {
          ...aNewMessageWithoutContent,
          content: {
            markdown: aMessagePayload.content.markdown,
            subject: aMessageSubject
          },
          createdAt: expect.any(Date),
          kind: "INewMessageWithContent"
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "api.messages.create",
        properties: {
          hasDefaultEmail: "false",
          senderServiceId: "test",
          senderUserId: "u123",
          success: "true"
        }
      })
    );

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.set).toBeCalledWith(
        "Location",
        `/api/v1/messages/${aFiscalCode}/${messageDocument.id}`
      );
    }
  });

  it("should create a new message for a limited auhorization recipient", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const anAuthorizedService = {
      ...someUserAttributes.service,
      authorizedRecipients: new Set([aFiscalCode])
    };

    const someAuthorizedUserAttributes = {
      ...someUserAttributes,
      service: anAuthorizedService
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiLimitedMessageWrite])
      },
      undefined as any, // not used
      someAuthorizedUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument = mockMessageModel.create.mock.calls[0][0];
    expect(NewMessage.is(messageDocument)).toBeTruthy();
    expect(NewMessageWithContent.is(messageDocument.content)).toBeFalsy();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: {
          ...aNewMessageWithoutContent,
          content: {
            markdown: aMessagePayload.content.markdown,
            subject: aMessagePayload.content.subject
          },
          createdAt: expect.any(Date),
          kind: "INewMessageWithContent"
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "api.messages.create",
        properties: {
          hasDefaultEmail: "false",
          senderServiceId: "test",
          senderUserId: "u123",
          success: "true"
        }
      })
    );

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.set).toBeCalledWith(
        "Location",
        `/api/v1/messages/${aFiscalCode}/${messageDocument.id}`
      );
    }
  });

  it("should handle custom subject", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiMessageWrite])
      },
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      {
        ...aMessagePayload,
        content: {
          markdown: aMessagePayload.content.markdown,
          subject: aCustomSubject
        }
      }
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument = mockMessageModel.create.mock.calls[0][0];
    expect(NewMessage.is(messageDocument)).toBeTruthy();
    expect(NewMessageWithContent.is(messageDocument.content)).toBeFalsy();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: {
          ...aNewMessageWithoutContent,
          content: {
            markdown: aMessagePayload.content.markdown,
            subject: aCustomSubject
          },
          createdAt: expect.any(Date),
          kind: "INewMessageWithContent"
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "api.messages.create",
        properties: {
          hasDefaultEmail: "false",
          senderServiceId: "test",
          senderUserId: "u123",
          success: "true"
        }
      })
    );

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.set).toBeCalledWith(
        "Location",
        `/api/v1/messages/${aFiscalCode}/${messageDocument.id}`
      );
    }
  });

  it("should handle default addresses when creating a new message", async () => {
    const mockMessageModel = {
      create: jest.fn(() =>
        Promise.resolve(right(aRetrievedMessageWithoutContent))
      )
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: ApiNewMessageWithDefaults = {
      ...aMessagePayload,
      default_addresses: {
        email: "test@example.com" as EmailAddress
      }
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([
          UserGroup.ApiMessageWrite,
          UserGroup.ApiMessageWriteDefaultAddress
        ])
      },
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      messagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument = mockMessageModel.create.mock.calls[0][0];

    expect(NewMessageWithoutContent.is(messageDocument)).toBeTruthy();
    expect(MessageContent.is(messageDocument.content)).toBeFalsy();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        defaultAddresses: {
          email: "test@example.com" as EmailAddress
        },
        message: {
          ...aNewMessageWithoutContent,
          content: {
            markdown: messagePayload.content.markdown,
            subject: messagePayload.content.subject
          },
          createdAt: expect.any(Date),
          kind: "INewMessageWithContent"
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "api.messages.create",
        properties: {
          hasDefaultEmail: "true",
          senderServiceId: "test",
          senderUserId: "u123",
          success: "true"
        }
      })
    );

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.set).toBeCalledWith(
        "Location",
        `/api/v1/messages/${aFiscalCode}/${messageDocument.id}`
      );
    }
  });

  it("should require the user to be enabled for providing default addresses when creating a new message", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: ApiNewMessageWithDefaults = {
      ...aMessagePayload,
      default_addresses: {
        email: "test@example.com" as EmailAddress
      }
    };

    const result = await createMessageHandler(
      mockContext as any,
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      messagePayload
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();

    expect(mockContext.bindings).toEqual({
      createdMessage: undefined
    });

    expect(trackEventMock).not.toHaveBeenCalled();

    expect(result.kind).toBe(
      "IResponseErrorForbiddenNotAuthorizedForDefaultAddresses"
    );
  });

  it("should require the user to be enable for production to create a new message", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set()
      },
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();

    expect(result.kind).toBe(
      "IResponseErrorForbiddenNotAuthorizedForProduction"
    );
  });

  it("should return failure if creation fails", async () => {
    const mockMessageModel = {
      create: jest.fn(() => left("error"))
    };

    const createMessageHandler = CreateMessageHandler(
      getCustomTelemetryClient as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiMessageWrite])
      },
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "api.messages.create",
        properties: {
          error: "IResponseErrorQuery",
          hasDefaultEmail: "false",
          senderServiceId: "test",
          senderUserId: "u123",
          success: "false"
        }
      })
    );

    expect(mockContext.bindings).toEqual({});
    expect(result.kind).toBe("IResponseErrorQuery");
  });
});

describe("GetMessageHandler", () => {
  it("should respond with a message if requesting user is the sender", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      getNotificationModelMock(),
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getStoredContent).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessageResponse);
    }
  });

  it("should fail if any error occurs trying to retrieve the message content", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => left(new Error()))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      getNotificationModelMock(),
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getStoredContent).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseErrorInternal");
  });

  it("should respond with a message if requesting user is a trusted application", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      getNotificationModelMock(),
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getStoredContent).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessageResponse);
    }
  });

  it("should respond with forbidden if requesting user is not the sender", async () => {
    const message = {
      ...aRetrievedMessageWithoutContent,
      senderServiceId: "anotherOrg"
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(message))),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      {} as any,
      {} as any,
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should respond with not found a message doesn not exist", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(none)),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      {} as any,
      {} as any,
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should provide information about notification status", async () => {
    const aRetrievedNotification: RetrievedNotification = {
      _self: "xyz",
      _ts: 123,
      channels: {
        [NotificationChannelEnum.EMAIL]: {
          addressSource: NotificationAddressSourceEnum.PROFILE_ADDRESS,
          toAddress: "x@example.com" as EmailString
        }
      },
      fiscalCode: aFiscalCode,
      id: "A_NOTIFICATION_ID" as NonEmptyString,
      kind: "IRetrievedNotification",
      messageId: "A_MESSAGE_ID" as NonEmptyString
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      getNotificationModelMock(aRetrievedNotification),
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getStoredContent).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessageResponse);
    }
  });

  it("should fail if any error occurs trying to retrieve the message status", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(
        left<QueryError, Option<MessageStatus>>({
          body: "error",
          code: 1
        })
      ),
      getNotificationModelMock(),
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseErrorInternal");
  });
  it("should fail if any error occurs trying to retrieve the notification status", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getStoredContent: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      getMessageStatusModelMock(),
      {
        findNotificationForMessage: jest.fn(() =>
          Promise.resolve(
            left({
              body: "error",
              code: 1
            })
          )
        )
      } as any,
      getNotificationStatusModelMock(),
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseErrorInternal");
  });
});

describe("GetMessagesHandler", () => {
  it("should respond with the messages for the recipient", async () => {
    const mockIterator = {
      executeNext: jest.fn()
    };

    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some([{ data: "a" }])))
    );
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const mockMessageModel = {
      findMessages: jest.fn(() => mockIterator)
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const result = await getMessagesHandler(
      aUserAuthenticationDeveloper,
      undefined as any, // not used
      undefined as any, // not used
      aFiscalCode
    );

    expect(result.kind).toBe("IResponseSuccessJsonIterator");

    const mockResponse = MockResponse();
    result.apply(mockResponse);

    await Promise.resolve(); // needed to let the response promise complete

    expect(mockIterator.executeNext).toHaveBeenCalledTimes(2);
  });
});

describe("MessagePayloadMiddleware", () => {
  it("should pass on valid message payloads", async () => {
    const fixtures: ReadonlyArray<any> = [
      {
        content: {
          markdown: "test".repeat(100),
          subject: "test subject"
        }
      },
      {
        content: {
          markdown: "test".repeat(100),
          subject: "test subject"
        },
        default_addresses: {
          email: "test@example.com"
        }
      },
      {
        content: {
          markdown: "test".repeat(100),
          subject: "test subject"
        },
        time_to_live: 4000
      }
    ];
    await Promise.all(
      fixtures.map(async f => {
        const r = {
          body: f
        };
        const result = await MessagePayloadMiddleware(r as any);
        expect(isRight(result)).toBeTruthy();
        expect(result.value).toEqual({
          ...f,
          default_addresses: f.default_addresses,
          time_to_live: f.time_to_live || 3600
        });
      })
    );
  });

  it("should reject on invalid message payloads", async () => {
    const fixtures: ReadonlyArray<any> = [
      {},
      {
        content: {
          markdown: 123456
        }
      },
      {
        content: {
          markdown: 123456,
          subject: "x".repeat(120)
        }
      },
      {
        content: {
          markdown: ""
        }
      },
      {
        content: {
          markdown: "x".repeat(100000)
        }
      },
      {
        content: {
          markdown: "x".repeat(1000),
          subject: "x".repeat(1)
        }
      },
      {
        content: {
          markdown: "x".repeat(100),
          subject: "test subject"
        },
        default_addresses: {
          email: "@example.com"
        }
      }
    ];
    await Promise.all(
      fixtures.map(async f => {
        const r = {
          body: f
        };
        const result = await MessagePayloadMiddleware(r as any);
        expect(isLeft(result)).toBeTruthy();
        if (isLeft(result)) {
          expect(result.value.kind).toEqual("IResponseErrorValidation");
        }
      })
    );
  });
});

describe("CreateMessage", () => {
  it("should fail with 500 if context cannot be retrieved", async () => {
    const headers: IHeaders = {
      "x-subscription-id": "someId",
      "x-user-groups": "ApiMessageWrite"
    };
    const createMessage = CreateMessage({} as any, {} as any, {} as any);
    const mockResponse = MockResponse();
    const request = {
      app: {
        get: jest.fn(() => undefined)
      },
      body: {},
      header: jest.fn(lookup(headers)),
      params: { fiscalcode: "x" }
    };
    await createMessage(request as any, mockResponse, _ => _);
    expect(request.app.get).toHaveBeenCalledWith("context");
    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json"
    );
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it("should respond with 403 if no valid authorization scopes are present", async () => {
    const headers: IHeaders = {
      "x-user-groups": ""
    };
    const createMessage = CreateMessage({} as any, {} as any, {} as any);
    const mockResponse = MockResponse();
    const request = {
      app: {
        get: jest.fn(() => {
          return {};
        })
      },
      body: {},
      header: jest.fn(lookup(headers)),
      params: { fiscalcode: "x" }
    };
    await createMessage(request as any, mockResponse, _ => _);
    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json"
    );
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });

  it("respond with 403 if the user cannot be identified", async () => {
    const headers: IHeaders = {
      "x-subscription-id": "someId",
      "x-user-groups": "ApiMessageWrite"
    };
    const createMessage = CreateMessage({} as any, {} as any, {} as any);
    const mockResponse = MockResponse();
    const request = {
      app: {
        get: jest.fn(() => {
          return {};
        })
      },
      body: {},
      header: jest.fn(lookup(headers)),
      params: { fiscalcode: "x" }
    };
    await createMessage(request as any, mockResponse, _ => _);
    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json"
    );
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });
});
