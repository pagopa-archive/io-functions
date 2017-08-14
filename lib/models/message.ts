import * as mongoose from "mongoose";

import { IMessage } from "../interfaces/message";

import { FiscalCode } from "../utils/fiscalcode";

export interface IMessageModel extends IMessage, mongoose.Document { }

/**
 * A model for handling Messages
 */
export class MessageModel {
  private messageModel: mongoose.Model<IMessageModel>;

  /**
   * Creates a new MessageModel
   *
   * @param messageModel A Mongoose model for Messages
   */
  constructor(messageModel: mongoose.Model<IMessageModel>) {
    this.messageModel = messageModel;
  }

  /**
   * Creates a new Message
   *
   * @param message The new Message
   */
  public createMessage(message: IMessage): Promise<IMessageModel> {
    return this.messageModel.create(message);
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public async findMessage(fiscalCode: FiscalCode, messageId: string): Promise<IMessageModel | null> {
    const message = await this.messageModel.findById(messageId).exec();
    if (message != null && message.fiscalCode === fiscalCode) {
      return message;
    } else {
      return null;
    }
  }

  /**
   * Returns the messages for the provided fiscal code
   *
   * @param fiscalCode The fiscal code of the recipient
   */
  public async findMessages(fiscalCode: FiscalCode): Promise<IMessageModel[]> {
    return this.messageModel.find({ fiscalCode })
      .sort({ createdAt: "descending" })
      .exec();
  }

}
