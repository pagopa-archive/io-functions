/*
 * Implements the API handlers for the Message resource.
 */
import * as express from "express";
import * as t from "io-ts";
import * as winston from "winston";

import {
  ClientIp,
  ClientIpMiddleware
} from "io-functions-commons/dist/src/utils/middlewares/client_ip_middleware";

import { Context } from "@azure/functions";

import { CreatedMessageWithoutContent } from "../api/definitions/CreatedMessageWithoutContent";
import { FiscalCode } from "../api/definitions/FiscalCode";

import { MessageResponseWithContent } from "../api/definitions/MessageResponseWithContent";
import { NewMessage as ApiNewMessage } from "../api/definitions/NewMessage";

import { CreatedMessageEvent } from "io-functions-commons/dist/src/models/created_message_event";

import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";

import {
  IResponseErrorQuery,
  IResponseSuccessJsonIterator,
  ResponseErrorQuery,
  ResponseJsonIterator
} from "io-functions-commons/dist/src/utils/response";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "io-functions-commons/dist/src/utils/middlewares/azure_api_auth";
import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "io-functions-commons/dist/src/utils/middlewares/azure_user_attributes";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  ObjectIdGenerator,
  ulidGenerator
} from "io-functions-commons/dist/src/utils/strings";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  IResponseErrorForbiddenNotAuthorizedForProduction,
  IResponseErrorForbiddenNotAuthorizedForRecipient,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  ResponseErrorForbiddenNotAuthorizedForProduction,
  ResponseErrorForbiddenNotAuthorizedForRecipient,
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple as ipTuple
} from "../utils/source_ip_check";

import {
  filterResultIterator,
  mapResultIterator
} from "io-functions-commons/dist/src/utils/documentdb";

import { NotificationModel } from "io-functions-commons/dist/src/models/notification";
import { ServiceModel } from "io-functions-commons/dist/src/models/service";

import { BlobService } from "azure-storage";

import {
  Message,
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessage
} from "io-functions-commons/dist/src/models/message";

import { withoutUndefinedValues } from "italia-ts-commons/lib/types";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import {
  fromEither as OptionFromEither,
  isNone,
  none,
  Option,
  some
} from "fp-ts/lib/Option";

import { MessageStatusModel } from "io-functions-commons/dist/src/models/message_status";
import { NotificationStatusModel } from "io-functions-commons/dist/src/models/notification_status";
import { CreatedMessageWithContent } from "../api/definitions/CreatedMessageWithContent";
import { MessageResponseWithoutContent } from "../api/definitions/MessageResponseWithoutContent";
import { MessageStatusValueEnum } from "../api/definitions/MessageStatusValue";
import { NotificationChannelEnum } from "../api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../api/definitions/NotificationChannelStatusValue";
import { TimeToLiveSeconds } from "../api/definitions/TimeToLiveSeconds";
import {
  CustomTelemetryClientFactory,
  diffInMilliseconds
} from "../utils/application_insights";

const ApiNewMessageWithDefaults = t.intersection([
  ApiNewMessage,
  t.interface({ time_to_live: TimeToLiveSeconds })
]);
export type ApiNewMessageWithDefaults = t.TypeOf<
  typeof ApiNewMessageWithDefaults
>;

/**
 * A request middleware that validates the Message payload.
 */
export const MessagePayloadMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  ApiNewMessageWithDefaults
> = request =>
  new Promise(resolve => {
    return resolve(
      ApiNewMessageWithDefaults.decode(request.body).mapLeft(
        ResponseErrorFromValidationErrors(ApiNewMessageWithDefaults)
      )
    );
  });

/**
 * Converts a retrieved message to a message that can be shared via API
 */
function retrievedMessageToPublic(
  retrievedMessage: RetrievedMessage
): CreatedMessageWithoutContent {
  return {
    created_at: retrievedMessage.createdAt,
    fiscal_code: retrievedMessage.fiscalCode,
    id: retrievedMessage.id,
    sender_service_id: retrievedMessage.senderServiceId
  };
}

/**
 * Type of a CreateMessage handler.
 *
 * CreateMessage expects an Azure Function Context and FiscalCode as input
 * and returns the created Message as output.
 * The Context is needed to output the created Message to a queue for
 * further processing.
 */
type ICreateMessageHandler = (
  context: Context,
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  messagePayload: ApiNewMessageWithDefaults
) => Promise<
  // tslint:disable-next-line:max-union-size
  | IResponseSuccessRedirectToResource<Message, {}>
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenNotAuthorizedForRecipient
  | IResponseErrorForbiddenNotAuthorizedForProduction
  | IResponseErrorForbiddenNotAuthorizedForDefaultAddresses
>;

/**
 * Type of a GetMessage handler.
 *
 * GetMessage expects a FiscalCode and a Message ID as input
 * and returns a Message as output or a Not Found or Validation
 * errors.
 */
type IGetMessageHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode,
  messageId: string
) => Promise<
  // tslint:disable-next-line:max-union-size
  | IResponseSuccessJson<
      MessageResponseWithContent | MessageResponseWithoutContent
    >
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
>;

/**
 * Type of a GetMessages handler.
 *
 * GetMessages expects a FiscalCode as input and returns the Messages
 * as output or a Validation error.
 *
 * TODO: add full results and paging
 */
type IGetMessagesHandler = (
  auth: IAzureApiAuthorization,
  clientIp: ClientIp,
  attrs: IAzureUserAttributes,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJsonIterator<CreatedMessageWithoutContent>
  | IResponseErrorValidation
  | IResponseErrorQuery
>;

/**
 * Convenience structure to hold notification channels
 * and the status of the relative notification
 * ie. { email: "SENT" }
 */
type NotificationStatusHolder = Partial<
  Record<NotificationChannelEnum, NotificationChannelStatusValueEnum>
>;

/**
 * Returns the status of a channel
 */
async function getChannelStatus(
  notificationStatusModel: NotificationStatusModel,
  notificationId: NonEmptyString,
  channel: NotificationChannelEnum
): Promise<NotificationChannelStatusValueEnum | undefined> {
  const errorOrMaybeStatus = await notificationStatusModel.findOneNotificationStatusByNotificationChannel(
    notificationId,
    channel
  );
  return OptionFromEither(errorOrMaybeStatus)
    .chain(t.identity)
    .map(o => o.status)
    .toUndefined();
}

/**
 * Retrieve all notifications statuses (all channels) for a message.
 *
 * It makes one query to get the notification object associated
 * to a message, then another query for each channel
 * to retrieve the relative notification status.
 *
 * @returns an object with channels as keys and statuses as values
 *          ie. { email: "SENT" }
 */
async function getMessageNotificationStatuses(
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  messageId: NonEmptyString
): Promise<Either<Error, Option<NotificationStatusHolder>>> {
  const errorOrMaybeNotification = await notificationModel.findNotificationForMessage(
    messageId
  );
  if (isRight(errorOrMaybeNotification)) {
    // It may happen that the notification object is not yet created in the database
    // due to some latency, so it's better to not fail here but return an empty object
    const maybeNotification = errorOrMaybeNotification.value;
    if (isNone(maybeNotification)) {
      winston.debug(
        `getMessageNotificationStatuses|Notification not found|messageId=${messageId}`
      );
      return right<Error, Option<NotificationStatusHolder>>(none);
    }
    const notification = maybeNotification.value;

    // collect the statuses of all channels
    const channelStatusesPromises = Object.keys(NotificationChannelEnum)
      .map(k => NotificationChannelEnum[k as NotificationChannelEnum])
      .map(async channel => ({
        channel,
        status: await getChannelStatus(
          notificationStatusModel,
          notification.id,
          channel
        )
      }));
    const channelStatuses = await Promise.all(channelStatusesPromises);

    // reduce the statuses in one response
    const response = channelStatuses.reduce<NotificationStatusHolder>(
      (a, s) =>
        s.status
          ? {
              ...a,
              [s.channel.toLowerCase()]: s.status
            }
          : a,
      {}
    );
    return right<Error, Option<NotificationStatusHolder>>(some(response));
  } else {
    winston.error(
      `getMessageNotificationStatuses|Query error|${
        errorOrMaybeNotification.value.body
      }`
    );
    return left<Error, Option<NotificationStatusHolder>>(
      new Error(`Error querying for NotificationStatus`)
    );
  }
}

/**
 * Returns a type safe CreateMessage handler.
 */
// tslint:disable-next-line:cognitive-complexity no-big-function
export function CreateMessageHandler(
  getCustomTelemetryClient: CustomTelemetryClientFactory,
  messageModel: MessageModel,
  generateObjectId: ObjectIdGenerator
): ICreateMessageHandler {
  return async (
    context,
    auth,
    _,
    userAttributes,
    fiscalCode,
    messagePayload
  ) => {
    // extract the user service
    const userService = userAttributes.service;

    const startRequestTime = process.hrtime();

    // base appinsights event attributes for convenience (used later)
    const appInsightsEventName = "api.messages.create";
    const appInsightsEventProps = {
      hasDefaultEmail: Boolean(
        messagePayload.default_addresses &&
          messagePayload.default_addresses.email
      ).toString(),
      senderServiceId: userService.serviceId,
      senderUserId: auth.userId
    };

    //
    // authorization checks
    //

    // check whether the user is authorized to send messages to limited recipients
    // or whether the user is authorized to send messages to any recipient
    if (auth.groups.has(UserGroup.ApiLimitedMessageWrite)) {
      // user is in limited message creation mode, check whether he's sending
      // the message to an authorized recipient
      if (!userAttributes.service.authorizedRecipients.has(fiscalCode)) {
        return ResponseErrorForbiddenNotAuthorizedForRecipient;
      }
    } else if (!auth.groups.has(UserGroup.ApiMessageWrite)) {
      // the user is doing a production call but he's not enabled
      return ResponseErrorForbiddenNotAuthorizedForProduction;
    }

    // check whether the user is authorized to provide default addresses
    if (
      messagePayload.default_addresses &&
      !auth.groups.has(UserGroup.ApiMessageWriteDefaultAddress)
    ) {
      // the user is sending a message by providing default addresses but he's
      // not allowed to do so.
      return ResponseErrorForbiddenNotAuthorizedForDefaultAddresses;
    }

    const requestedAmount = messagePayload.content.payment_data
      ? messagePayload.content.payment_data.amount
      : undefined;

    const hasExceededAmount =
      requestedAmount &&
      requestedAmount > (userService.maxAllowedPaymentAmount as number);

    // check if the service wants to charge a valid amount to the user
    if (hasExceededAmount) {
      return ResponseErrorValidation(
        "Error while sending payment metadata",
        `The requested amount (${requestedAmount} cents) exceeds the maximum allowed for this service (${
          userService.maxAllowedPaymentAmount
        } cents)`
      );
    }

    const id = generateObjectId();

    // create a new message from the payload
    // this object contains only the message metadata, the content of the
    // message is handled separately (see below).
    const newMessageWithoutContent: NewMessageWithoutContent = {
      createdAt: new Date(),
      fiscalCode,
      id,
      indexedId: id,
      isPending: true,
      kind: "INewMessageWithoutContent",
      senderServiceId: userService.serviceId,
      senderUserId: auth.userId,
      timeToLiveSeconds: messagePayload.time_to_live
    };

    //
    // handle real message creation requests
    //

    // attempt to create the message
    const errorOrMessage = await messageModel.create(
      newMessageWithoutContent,
      newMessageWithoutContent.fiscalCode
    );

    const appInsightsClient = getCustomTelemetryClient(
      {
        operationId: newMessageWithoutContent.id,
        serviceId: userService.serviceId
      },
      {
        messageId: newMessageWithoutContent.id
      }
    );

    if (isLeft(errorOrMessage)) {
      // we got an error while creating the message

      // track the event that a message has failed to be created
      appInsightsClient.trackEvent({
        name: appInsightsEventName,
        properties: {
          ...appInsightsEventProps,
          error: "IResponseErrorQuery",
          success: "false"
        }
      });

      winston.debug(
        `CreateMessageHandler|error|${JSON.stringify(errorOrMessage.value)}`
      );

      // return an error response
      return ResponseErrorQuery(
        "Error while creating Message",
        errorOrMessage.value
      );
    }

    // message creation succeeded
    const retrievedMessage = errorOrMessage.value;

    winston.debug(
      `CreateMessageHandler|message created|${userService.serviceId}|${
        retrievedMessage.id
      }`
    );

    //
    // emit created message event to the output queue
    //

    // prepare the created message event
    // we filter out undefined values as they are
    // deserialized to null(s) when enqueued
    const createdMessageEventOrError = CreatedMessageEvent.decode(
      withoutUndefinedValues({
        content: messagePayload.content,
        defaultAddresses: messagePayload.default_addresses,
        message: newMessageWithoutContent,
        senderMetadata: {
          departmentName: userAttributes.service.departmentName,
          organizationFiscalCode: userAttributes.service.organizationFiscalCode,
          organizationName: userAttributes.service.organizationName,
          serviceName: userAttributes.service.serviceName
        },
        serviceVersion: userAttributes.service.version
      })
    );

    if (isLeft(createdMessageEventOrError)) {
      winston.error(
        `CreateMessageHandler|Unable to decode CreatedMessageEvent|${
          userService.serviceId
        }|${retrievedMessage.id}|${readableReport(
          createdMessageEventOrError.value
        ).replace(/\n/g, " / ")}`
      );

      return ResponseErrorValidation(
        "Unable to decode CreatedMessageEvent",
        readableReport(createdMessageEventOrError.value)
      );
    }

    // queue the message to the created messages queue by setting
    // the message to the output binding of this function
    // tslint:disable-next-line:no-object-mutation
    context.bindings.createdMessage = createdMessageEventOrError.value;

    //
    // generate appinsights event
    //

    // track the event that a message has been created
    appInsightsClient.trackEvent({
      measurements: {
        duration: diffInMilliseconds(startRequestTime)
      },
      name: appInsightsEventName,
      properties: {
        ...appInsightsEventProps,
        success: "true"
      }
    });

    //
    // respond to request
    //

    // redirect the client to the message resource
    return ResponseSuccessRedirectToResource(
      newMessageWithoutContent,
      `/api/v1/messages/${fiscalCode}/${newMessageWithoutContent.id}`,
      { id: newMessageWithoutContent.id }
    );
  };
}

/**
 * Wraps a CreateMessage handler inside an Express request handler.
 */
export function CreateMessage(
  getCustomTelemetryClient: CustomTelemetryClientFactory,
  serviceModel: ServiceModel,
  messageModel: MessageModel
): express.RequestHandler {
  const handler = CreateMessageHandler(
    getCustomTelemetryClient,
    messageModel,
    ulidGenerator
  );
  const middlewaresWrap = withRequestMiddlewares(
    // extract Azure Functions bindings
    ContextMiddleware(),
    // allow only users in the ApiMessageWrite and ApiMessageWriteLimited groups
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageWrite, UserGroup.ApiLimitedMessageWrite])
    ),
    // extracts the client IP from the request
    ClientIpMiddleware,
    // extracts custom user attributes from the request
    AzureUserAttributesMiddleware(serviceModel),
    // extracts the fiscal code from the request params
    FiscalCodeMiddleware,
    // extracts the create message payload from the request body
    MessagePayloadMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, __, c, u, ___, ____) =>
        ipTuple(c, u)
      )
    )
  );
}

/**
 * Handles requests for getting a single message for a recipient.
 */
export function GetMessageHandler(
  messageModel: MessageModel,
  messageStatusModel: MessageStatusModel,
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  blobService: BlobService
): IGetMessageHandler {
  return async (userAuth, _, userAttributes, fiscalCode, messageId) => {
    const errorOrMaybeDocument = await messageModel.findMessageForRecipient(
      fiscalCode,
      messageId
    );

    if (isLeft(errorOrMaybeDocument)) {
      // the query failed
      return ResponseErrorQuery(
        "Error while retrieving the message",
        errorOrMaybeDocument.value
      );
    }

    const maybeDocument = errorOrMaybeDocument.value;
    if (isNone(maybeDocument)) {
      // the document does not exist
      return ResponseErrorNotFound(
        "Message not found",
        "The message that you requested was not found in the system."
      );
    }

    const retrievedMessage = maybeDocument.value;

    // whether the user is a trusted application (i.e. can access all messages for any recipient)
    const canListMessages = userAuth.groups.has(UserGroup.ApiMessageList);

    // the user is allowed to see the message when he is either
    // a trusted application or he is the sender of the message
    const isUserAllowed =
      canListMessages ||
      retrievedMessage.senderServiceId === userAttributes.service.serviceId;

    if (!isUserAllowed) {
      // the user is not allowed to see the message
      return ResponseErrorForbiddenNotAuthorized;
    }

    // fetch the content of the message from the blob storage
    const errorOrMaybeContent = await messageModel.getStoredContent(
      blobService,
      retrievedMessage.id,
      retrievedMessage.fiscalCode
    );

    if (isLeft(errorOrMaybeContent)) {
      winston.error(
        `GetMessageHandler|${JSON.stringify(errorOrMaybeContent.value)}`
      );
      return ResponseErrorInternal(
        `${errorOrMaybeContent.value.name}: ${
          errorOrMaybeContent.value.message
        }`
      );
    }

    const message:
      | CreatedMessageWithContent
      | CreatedMessageWithoutContent = withoutUndefinedValues({
      content: errorOrMaybeContent.value.toUndefined(),
      ...retrievedMessageToPublic(retrievedMessage)
    });

    const errorOrNotificationStatuses = await getMessageNotificationStatuses(
      notificationModel,
      notificationStatusModel,
      retrievedMessage.id
    );

    if (isLeft(errorOrNotificationStatuses)) {
      return ResponseErrorInternal(
        `Error retrieving NotificationStatus: ${
          errorOrNotificationStatuses.value.name
        }|${errorOrNotificationStatuses.value.message}`
      );
    }
    const notificationStatuses = errorOrNotificationStatuses.value;

    const errorOrMaybeMessageStatus = await messageStatusModel.findOneByMessageId(
      retrievedMessage.id
    );

    if (isLeft(errorOrMaybeMessageStatus)) {
      return ResponseErrorInternal(
        `Error retrieving MessageStatus: ${
          errorOrMaybeMessageStatus.value.code
        }|${errorOrMaybeMessageStatus.value.body}`
      );
    }
    const maybeMessageStatus = errorOrMaybeMessageStatus.value;

    const returnedMessage:
      | MessageResponseWithContent
      | MessageResponseWithoutContent = {
      message,
      notification: notificationStatuses.toUndefined(),
      // we do not return the status date-time
      status: maybeMessageStatus
        .map(messageStatus => messageStatus.status)
        // when the message has been received but a MessageStatus
        // does not exist yet, the message is considered to be
        // in the ACCEPTED state (not yet stored in the inbox)
        .getOrElse(MessageStatusValueEnum.ACCEPTED)
    };

    return ResponseSuccessJson(returnedMessage);
  };
}

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
export function GetMessage(
  serviceModel: ServiceModel,
  messageModel: MessageModel,
  messageStatusModel: MessageStatusModel,
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  blobService: BlobService
): express.RequestHandler {
  const handler = GetMessageHandler(
    messageModel,
    messageStatusModel,
    notificationModel,
    notificationStatusModel,
    blobService
  );
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(
      new Set([UserGroup.ApiMessageRead, UserGroup.ApiMessageList])
    ),
    ClientIpMiddleware,
    AzureUserAttributesMiddleware(serviceModel),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("id", NonEmptyString)
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __, ___) => ipTuple(c, u))
    )
  );
}

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(
  messageModel: MessageModel
): IGetMessagesHandler {
  return async (_, __, ___, fiscalCode) => {
    const retrievedMessagesIterator = messageModel.findMessages(fiscalCode);
    const validMessagesIterator = filterResultIterator(
      retrievedMessagesIterator,
      // isPending is true when the message has been received from the sender
      // but it's still being processed
      message => message.isPending !== true
    );
    const publicExtendedMessagesIterator = mapResultIterator(
      validMessagesIterator,
      retrievedMessageToPublic
    );
    return ResponseJsonIterator(publicExtendedMessagesIterator);
  };
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  serviceModel: ServiceModel,
  messageModel: MessageModel
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    AzureApiAuthMiddleware(new Set([UserGroup.ApiMessageList])),
    ClientIpMiddleware,
    AzureUserAttributesMiddleware(serviceModel),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(
    middlewaresWrap(
      checkSourceIpForHandler(handler, (_, c, u, __) => ipTuple(c, u))
    )
  );
}
