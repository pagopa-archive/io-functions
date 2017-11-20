// tslint:disable:no-any

import * as winston from "winston";
winston.configure({
  level: "debug"
});

import { response as MockResponse } from "jest-mock-express";

import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, Option, some, Some } from "fp-ts/lib/Option";

import { ModelId } from "../../utils/documentdb_model_versioned";

import { CreatedMessage } from "../../api/definitions/CreatedMessage";
import { toEmailAddress } from "../../api/definitions/EmailAddress";
import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { toMessageBodyMarkdown } from "../../api/definitions/MessageBodyMarkdown";
import { toMessageSubject } from "../../api/definitions/MessageSubject";
import { NewMessage } from "../../api/definitions/NewMessage";
import { NotificationChannelStatus } from "../../api/definitions/NotificationChannelStatus";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { IAzureUserAttributes } from "../../utils/middlewares/azure_user_attributes";
import { toEmailString, toNonEmptyString } from "../../utils/strings";

import {
  INewMessage,
  INewMessageWithoutContent,
  IRetrievedMessageWithoutContent
} from "../../models/message";
import {
  IRetrievedNotification,
  NotificationAddressSource
} from "../../models/notification";
import {
  CreateMessage,
  CreateMessageHandler,
  GetMessageHandler,
  GetMessagesHandler,
  MessagePayloadMiddleware
} from "../messages";

// DANGEROUS, only use in tests
function _getO<T>(o: Option<T>): T {
  return (o as Some<T>).value;
}

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const aFiscalCode = _getO(toFiscalCode("FRLFRC74E04B157I"));
const anEmail = _getO(toEmailString("test@example.com"));
const aMessageBodyMarkdown = _getO(toMessageBodyMarkdown("test".repeat(80)));

const someUserAttributes: IAzureUserAttributes = {
  email: anEmail,
  kind: "IAzureUserAttributes",
  service: {
    authorizedRecipients: new Set([]),
    departmentName: _getO(toNonEmptyString("IT")),
    organizationName: _getO(toNonEmptyString("AgID")),
    serviceId: _getO(toNonEmptyString("test")),
    serviceName: _getO(toNonEmptyString("Test"))
  }
};

const aUserAuthenticationDeveloper: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: _getO(toNonEmptyString("s123")),
  userId: _getO(toNonEmptyString("u123"))
};

const aUserAuthenticationTrustedApplication: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList]),
  kind: "IAzureApiAuthorization",
  subscriptionId: _getO(toNonEmptyString("s123")),
  userId: _getO(toNonEmptyString("u123"))
};

const aMessagePayload: NewMessage = {
  content: {
    markdown: aMessageBodyMarkdown
  }
};

const aCustomSubject = _getO(toMessageSubject("A custom subject"));

const aMessageId = _getO(toNonEmptyString("A_MESSAGE_ID"));

const aNewMessageWithoutContent: INewMessageWithoutContent = {
  fiscalCode: aFiscalCode,
  id: _getO(toNonEmptyString("A_MESSAGE_ID")),
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ModelId,
  senderUserId: _getO(toNonEmptyString("u123"))
};

const aRetrievedMessageWithoutContent: IRetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessageWithoutContent"
};

const aPublicExtendedMessage: CreatedMessage = {
  fiscal_code: aNewMessageWithoutContent.fiscalCode,
  id: "A_MESSAGE_ID",
  sender_service_id: aNewMessageWithoutContent.senderServiceId
};

describe("CreateMessageHandler", () => {
  it("should not authorize sending messages to unauthorized recipients", async () => {
    const mockMessageModel = {
      create: jest.fn()
    };

    const createMessageHandler = CreateMessageHandler(
      {} as any,
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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
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
      someUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument: INewMessage =
      mockMessageModel.create.mock.calls[0][0];
    expect(messageDocument.content).toBeUndefined();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: aNewMessageWithoutContent,
        messageContent: {
          bodyMarkdown: aMessagePayload.content.markdown
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        hasCustomSubject: "false",
        hasDefaultEmail: "false",
        senderServiceId: "test",
        senderUserId: "u123",
        success: "true"
      }
    });

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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
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
      someAuthorizedUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument: INewMessage =
      mockMessageModel.create.mock.calls[0][0];
    expect(messageDocument.content).toBeUndefined();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: aNewMessageWithoutContent,
        messageContent: {
          bodyMarkdown: aMessagePayload.content.markdown
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        hasCustomSubject: "false",
        hasDefaultEmail: "false",
        senderServiceId: "test",
        senderUserId: "u123",
        success: "true"
      }
    });

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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
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

    const messageDocument: INewMessage =
      mockMessageModel.create.mock.calls[0][0];
    expect(messageDocument.content).toBeUndefined();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: aNewMessageWithoutContent,
        messageContent: {
          bodyMarkdown: aMessagePayload.content.markdown,
          subject: aCustomSubject
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        hasCustomSubject: "true",
        hasDefaultEmail: "false",
        senderServiceId: "test",
        senderUserId: "u123",
        success: "true"
      }
    });

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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: NewMessage = {
      ...aMessagePayload,
      default_addresses: {
        email: _getO(toEmailAddress("test@example.com"))
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
      someUserAttributes,
      aFiscalCode,
      messagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument: INewMessage =
      mockMessageModel.create.mock.calls[0][0];
    expect(messageDocument.content).toBeUndefined();

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        defaultAddresses: {
          email: _getO(toEmailAddress("test@example.com"))
        },
        message: aNewMessageWithoutContent,
        messageContent: {
          bodyMarkdown: messagePayload.content.markdown
        },
        senderMetadata: {
          departmentName: "IT",
          organizationName: "AgID",
          serviceName: "Test"
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        hasCustomSubject: "false",
        hasDefaultEmail: "true",
        senderServiceId: "test",
        senderUserId: "u123",
        success: "true"
      }
    });

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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
      mockMessageModel as any,
      () => aMessageId
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: NewMessage = {
      ...aMessagePayload,
      default_addresses: {
        email: _getO(toEmailAddress("test@example.com"))
      }
    };

    const result = await createMessageHandler(
      mockContext as any,
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      messagePayload
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();

    expect(mockContext.bindings).toEqual({
      createdMessage: undefined
    });

    expect(mockAppInsights.trackEvent).not.toHaveBeenCalled();

    expect(result.kind).toBe(
      "IResponseErrorForbiddenNotAuthorizedForDefaultAddresses"
    );
  });

  it("should require the user to be enable for production to create a new message", async () => {
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessageWithoutContent))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
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
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => left("error"))
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
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
      someUserAttributes,
      aFiscalCode,
      aMessagePayload
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        error: "IResponseErrorQuery",
        hasCustomSubject: "false",
        hasDefaultEmail: "false",
        senderServiceId: "test",
        senderUserId: "u123",
        success: "false"
      }
    });

    expect(mockContext.bindings).toEqual({});
    expect(result.kind).toBe("IResponseErrorQuery");
  });
});

describe("GetMessageHandler", () => {
  it("should respond with a message if requesting user is the sender", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      )
    };

    const mockNotificationModel = {
      findNotificationForMessage: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      mockNotificationModel as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual({
        message: aPublicExtendedMessage
      });
    }
  });

  it("should respond with a message if requesting user is a trusted application", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      )
    };

    const mockNotificationModel = {
      findNotificationForMessage: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      mockNotificationModel as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual({
        message: aPublicExtendedMessage
      });
    }
  });

  it("should respond with forbidden if requesting user is not the sender", async () => {
    const message = {
      ...aRetrievedMessageWithoutContent,
      senderServiceId: "anotherOrg"
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(message)))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
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
      findMessageForRecipient: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should provide information about notification status", async () => {
    const aRetrievedNotification: IRetrievedNotification = {
      _self: "xyz",
      _ts: "xyz",
      emailNotification: {
        addressSource: NotificationAddressSource.PROFILE_ADDRESS,
        status: NotificationChannelStatus.SENT_TO_CHANNEL,
        toAddress: _getO(toEmailString("x@example.com"))
      },
      fiscalCode: aFiscalCode,
      id: _getO(toNonEmptyString("A_NOTIFICATION_ID")),
      kind: "IRetrievedNotification",
      messageId: _getO(toNonEmptyString("A_MESSAGE_ID"))
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      )
    };

    const mockNotificationModel = {
      findNotificationForMessage: jest.fn(() =>
        right(some(aRetrievedNotification))
      )
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      mockNotificationModel as any
    );

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual({
        message: aPublicExtendedMessage,
        notification: {
          email: "SENT_TO_CHANNEL"
        }
      });
    }
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
          markdown: "test".repeat(100)
        }
      },
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
      }
    ];
    await Promise.all(
      fixtures.map(async f => {
        const r = {
          body: f
        };
        const result = await MessagePayloadMiddleware(r as any);
        expect(isRight(result)).toBeTruthy();
        expect(result.value).toEqual(f);
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
    const createMessage = CreateMessage({} as any, {} as any, {} as any);
    const mockResponse = MockResponse();
    const request = {
      app: {
        get: jest.fn(() => undefined)
      },
      body: {}
    };
    createMessage(request as any, mockResponse as any, _ => _);
    await Promise.resolve({});
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
      header: jest.fn(lookup(headers))
    };
    createMessage(request as any, mockResponse as any, _ => _);
    await Promise.resolve({});
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
      header: jest.fn(lookup(headers))
    };
    createMessage(request as any, mockResponse as any, _ => _);
    await Promise.resolve({});
    // expect(request.header).toHaveBeenCalledWith("x-user-id");
    // expect(request.header).toHaveBeenCalledWith("x-subscription-id");
    expect(mockResponse.set).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json"
    );
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });
});
