// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { none, some } from "ts-option";
import { left, right } from "../../utils/either";

import { ModelId } from "../../utils/documentdb_model_versioned";

import { toBodyShort } from "../../api/definitions/BodyShort";
import { CreatedMessage } from "../../api/definitions/CreatedMessage";
import { toEmailAddress } from "../../api/definitions/EmailAddress";
import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { NewMessage } from "../../api/definitions/NewMessage";
import { NotificationChannelStatus } from "../../api/definitions/NotificationChannelStatus";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { IAzureUserAttributes } from "../../utils/middlewares/azure_user_attributes";
import { toNonEmptyString } from "../../utils/strings";

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
  CreateMessageHandler,
  GetMessageHandler,
  GetMessagesHandler
} from "../messages";

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const someUserAttributes: IAzureUserAttributes = {
  kind: "IAzureUserAttributes",
  organization: {
    name: "AgID",
    organizationId: "agid" as ModelId
  }
};

const aUserAuthenticationDeveloper: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageWrite]),
  kind: "IAzureApiAuthorization",
  subscriptionId: toNonEmptyString("s123").get,
  userId: toNonEmptyString("u123").get
};

const aUserAuthenticationTrustedApplication: IAzureApiAuthorization = {
  groups: new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList]),
  kind: "IAzureApiAuthorization",
  subscriptionId: toNonEmptyString("s123").get,
  userId: toNonEmptyString("u123").get
};

const aMessagePayload: NewMessage = {
  content: {
    body_short: toBodyShort("Hello, world!").get
  },
  dry_run: false
};

const aNewMessageWithoutContent: INewMessageWithoutContent = {
  fiscalCode: aFiscalCode,
  id: toNonEmptyString("A_MESSAGE_ID").get,
  kind: "INewMessageWithoutContent",
  senderOrganizationId: "agid" as ModelId,
  senderUserId: toNonEmptyString("u123").get
};

const aRetrievedMessageWithoutContent: IRetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessageWithoutContent"
};

const aPublicExtendedMessage: CreatedMessage = {
  content: {
    body_short: aNewMessageWithoutContent.bodyShort
  },
  fiscal_code: aNewMessageWithoutContent.fiscalCode,
  id: "A_MESSAGE_ID",
  sender_organization_id: aNewMessageWithoutContent.senderOrganizationId
};

describe("CreateMessageHandler", () => {
  it("should require the user to be part of an organization", async () => {
    const createMessageHandler = CreateMessageHandler({} as any, {} as any);
    const result = await createMessageHandler(
      {} as any,
      {} as any,
      {
        organization: undefined
      } as any,
      {} as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorValidation");
  });

  it("should allow dry run calls", async () => {
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn()
    };

    const createMessageHandler = CreateMessageHandler(
      mockAppInsights as any,
      mockMessageModel as any
    );

    const aDryRunMessagePayload: NewMessage = {
      ...aMessagePayload,
      dry_run: true
    };

    const mockContext = {
      bindings: {}
    };

    const result = await createMessageHandler(
      mockContext as any,
      {
        ...aUserAuthenticationDeveloper,
        groups: new Set([UserGroup.ApiMessageWriteDryRun])
      },
      someUserAttributes,
      {} as any,
      aDryRunMessagePayload
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();
    expect(mockContext.bindings).toEqual({});
    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        dryRun: "true",
        senderOrganizationId: "agid",
        senderUserId: "u123",
        success: "true"
      }
    });
    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.dry_run).toBeTruthy();
    }
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
      mockMessageModel as any
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
        message: aRetrievedMessageWithoutContent,
        messageContent: {
          bodyShort: aMessagePayload.content.body_short
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        dryRun: "false",
        hasDefaultEmail: "false",
        senderOrganizationId: "agid",
        senderUserId: "u123",
        success: "true"
      }
    });

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.redirect).toBeCalledWith(
        202,
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
      mockMessageModel as any
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: NewMessage = {
      ...aMessagePayload,
      default_addresses: {
        email: toEmailAddress("test@example.com").get
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
          email: toEmailAddress("test@example.com").get
        },
        message: aRetrievedMessageWithoutContent,
        messageContent: {
          bodyShort: messagePayload.content.body_short
        }
      }
    });

    expect(mockAppInsights.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockAppInsights.trackEvent).toHaveBeenCalledWith({
      name: "api.messages.create",
      properties: {
        dryRun: "false",
        hasDefaultEmail: "true",
        senderOrganizationId: "agid",
        senderUserId: "u123",
        success: "true"
      }
    });

    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.redirect).toBeCalledWith(
        202,
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
      mockMessageModel as any
    );

    const mockContext = {
      bindings: {},
      log: jest.fn()
    };

    const messagePayload: NewMessage = {
      ...aMessagePayload,
      default_addresses: {
        email: toEmailAddress("test@example.com").get
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
      mockMessageModel as any
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
      mockMessageModel as any
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
    expect(mockAppInsights.trackEvent).not.toHaveBeenCalled();

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

    const userAttributes: IAzureUserAttributes = {
      ...someUserAttributes,
      organization: undefined
    };

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      userAttributes,
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
      senderOrganizationId: "anotherOrg"
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
        toAddress: toNonEmptyString("x@example.com").get
      },
      fiscalCode: aFiscalCode,
      id: toNonEmptyString("A_NOTIFICATION_ID").get,
      kind: "IRetrievedNotification",
      messageId: toNonEmptyString("A_MESSAGE_ID").get
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

    const userAttributes: IAzureUserAttributes = {
      ...someUserAttributes,
      organization: undefined
    };

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      userAttributes,
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
