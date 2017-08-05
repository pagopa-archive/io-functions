import * as mongoose from "mongoose";

import { IMessage } from "../interfaces/message";

export interface IMessageModel extends IMessage, mongoose.Document { }

export class MessageModel {
  private messageModel: mongoose.Model<IMessageModel>;

  constructor(messageModel: mongoose.Model<IMessageModel>) {
    this.messageModel = messageModel;
  }

  public createMessage(message: IMessage): Promise<IMessageModel> {
    return this.messageModel.create(message);
  }

}
