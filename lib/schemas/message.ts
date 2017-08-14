/**
 * Defines the database schema for a Message
 */

import { Schema } from "mongoose";
import { isFiscalCode } from "../utils/fiscalcode";

export const messageSchema: Schema = new Schema({
  bodyShort: String,
  fiscalCode: {
    required: true,
    type: String,
    validate: {
      message: "{VALUE} is not a valid fiscal code.",
      validator: isFiscalCode,
    },
  },
}, {
  bufferCommands: false, // fail fast, see http://mongoosejs.com/docs/guide.html#bufferCommands
  emitIndexErrors: true, // emit error event when index build fails
  read: "nearest",
  timestamps: true, // track createdAt and updatedAt
});
