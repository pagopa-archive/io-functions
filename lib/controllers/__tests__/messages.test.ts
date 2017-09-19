// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { none, some } from "ts-option";
import { left, right } from "../../utils/either";

import { ModelId } from "../../utils/documentdb_model_versioned";

import { toBodyShort } from "../../api/definitions/BodyShort";
import { toEmailAddress } from "../../api/definitions/EmailAddress";
import { toFiscalCode } from "../../api/definitions/FiscalCode";
import { NewMessage } from "../../api/definitions/NewMessage";

import {
  IAzureApiAuthorization,
  UserGroup
} from "../../utils/middlewares/azure_api_auth";
import { IAzureUserAttributes } from "../../utils/middlewares/azure_user_attributes";
import { toNonEmptyString } from "../../utils/strings";

import {
  INewMessage,
  IPublicExtendedMessage,
  IRetrievedMessage
} from "../../models/message";
import {
  IRetrievedNotification,
  NotificationAddressSource,
  NotificationChannelStatus
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

const aNewMessage: INewMessage = {
  bodyShort: toBodyShort("some text").get,
  fiscalCode: aFiscalCode,
  id: toNonEmptyString("A_MESSAGE_ID").get,
  kind: "INewMessage",
  senderOrganizationId: "agid" as ModelId,
  senderUserId: toNonEmptyString("u123").get
};

const aRetrievedMessage: IRetrievedMessage = {
  ...aNewMessage,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessage"
};

const aPublicExtendedMessage: IPublicExtendedMessage = {
  bodyShort: aNewMessage.bodyShort,
  fiscalCode: aNewMessage.fiscalCode,
  kind: "IPublicExtendedMessage",
  senderOrganizationId: aNewMessage.senderOrganizationId
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
      expect(result.value.bodyShort).toEqual(
        aDryRunMessagePayload.content.body_short
      );
      expect(result.value.senderOrganizationId).toEqual(
        someUserAttributes.organization.organizationId
      );
      expect(result.value.status).toEqual("DRY_RUN_SUCCESS");
    }
  });

  it("should create a new message", async () => {
    const mockAppInsights = {
      trackEvent: jest.fn()
    };

    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessage))
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
    expect(messageDocument.bodyShort).toEqual(
      aMessagePayload.content.body_short
    );

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: aRetrievedMessage
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
      create: jest.fn(() => right(aRetrievedMessage))
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
    expect(messageDocument.bodyShort).toEqual(
      aMessagePayload.content.body_short
    );

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        defaultAddresses: {
          email: toEmailAddress("test@example.com").get
        },
        message: aRetrievedMessage
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
      create: jest.fn(() => right(aRetrievedMessage))
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
      create: jest.fn(() => right(aRetrievedMessage))
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
      findMessageForRecipient: jest.fn(() => right(some(aRetrievedMessage)))
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
      aRetrievedMessage.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode,
      aRetrievedMessage.id
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
      findMessageForRecipient: jest.fn(() => right(some(aRetrievedMessage)))
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
      aRetrievedMessage.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode,
      aRetrievedMessage.id
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
      ...aRetrievedMessage,
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
      aRetrievedMessage.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode,
      aRetrievedMessage.id
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
      aRetrievedMessage.id
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
        status: NotificationChannelStatus.NOTIFICATION_SENT_TO_CHANNEL,
        toAddress: toNonEmptyString("x@example.com").get
      },
      fiscalCode: aFiscalCode,
      id: toNonEmptyString("A_NOTIFICATION_ID").get,
      kind: "IRetrievedNotification",
      messageId: toNonEmptyString("A_MESSAGE_ID").get
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(aRetrievedMessage)))
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
      aRetrievedMessage.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode,
      aRetrievedMessage.id
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
