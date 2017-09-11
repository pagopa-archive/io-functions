// tslint:disable:no-any

import {IContextWithBindings, index} from "../created_message_queue_handler";
import {ICreatedMessageEvent} from "../models/created_message_event";
import {IRetrievedMessage} from "../models/message";

import * as DocumentDb from "documentdb";
import {FiscalCode, toFiscalCode} from "../utils/fiscalcode";

import {
  INewNotification,
  IRetrievedNotification,
} from "../models/notification";

const aCorrectFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;
const aWrongFiscalCode = "FRLFRC74E04B157" as FiscalCode;

const aNewNotification: INewNotification = {
  fiscalCode: aCorrectFiscalCode,
  id: "A_NOTIFICATION_ID",
  kind: "INewNotification",
  messageId: "A_MESSAGE_ID",
};

const aRetrievedNotification: IRetrievedNotification = {
  ...aNewNotification,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedNotification",
};

describe("CreatedMessageQueueHandler", () => {

  it("should return failure if createdMessageEvent is undefined", () => {
    const Mock = jest.fn<IContextWithBindings>(() => ({
      bindings: {
        createdMessage: undefined,
      },
      done: jest.fn((__, ___) => undefined),
      log: {
        error: jest.fn((__, ___) => undefined),
        info: jest.fn((__, ___) => undefined),
      },
    }));

    const contextMock = new Mock();

    const clientMock = {};

    index(contextMock, (clientMock as any)as DocumentDb.DocumentClient);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fatal! No valid message found in bindings.`);
  });

  it("should return failure if createdMessageEvent is invalid (wrong fiscal code)", () => {
    const aMessage: IRetrievedMessage = {
      _self: "",
      _ts: "",
      bodyShort: "",
      fiscalCode: aWrongFiscalCode,
      id: "",
      kind: "IRetrievedMessage",
      senderOrganizationId: "",
    };

    const aMessageEvent: ICreatedMessageEvent = {
      message: aMessage,
    };

    const Mock = jest.fn<IContextWithBindings>(() => ({
      bindings: {
        createdMessage: aMessageEvent,
      },
      done: jest.fn((__, ___) => undefined),
      log: {
        error: jest.fn((__, ___) => undefined),
        info: jest.fn((__, ___) => undefined),
      },
    }));

    const contextMock = new Mock();

    const clientMock = {};

    index(contextMock, (clientMock as any)as DocumentDb.DocumentClient);

    expect(contextMock.done).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error).toHaveBeenCalledTimes(1);
    expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fatal! No valid message found in bindings.`);
  });

  it("should return failure if no profile exists for fiscal code", async () => {
    const aMessage: IRetrievedMessage = {
      _self: "",
      _ts: "",
      bodyShort: "",
      fiscalCode: aCorrectFiscalCode,
      id: "",
      kind: "IRetrievedMessage",
      senderOrganizationId: "",
    };

    const aMessageEvent: ICreatedMessageEvent = {
      message: aMessage,
    };

    const Mock = jest.fn<IContextWithBindings>(() => ({
      bindings: {
        createdMessage: aMessageEvent,
      },
      done: jest.fn((__, ___) => undefined),
      log: {
        error: jest.fn((__, ___) => undefined),
        info: jest.fn((__, ___) => undefined),
      },
    }));

    const contextMock = new Mock();

    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(undefined, [], undefined)),
    };

    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb(undefined, aRetrievedNotification)),
      queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    index(contextMock, (clientMock as any)as DocumentDb.DocumentClient).then(() => {
      expect(contextMock.log.info).toHaveBeenCalledTimes(1);
      expect(contextMock.log.info.mock.calls[0][0]).toEqual(`A new message was created|${aMessage.id}|${aMessage.fiscalCode}`);
      expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);
      expect(clientMock.createDocument).toHaveBeenCalledTimes(0);
      expect(contextMock.done).toHaveBeenCalledTimes(1);
      expect(contextMock.log.error).toHaveBeenCalledTimes(1);
      expect(contextMock.log.error.mock.calls[0][0]).toEqual(`Fiscal code has no associated profile|${aMessage.fiscalCode}`);
    });
  });

});
