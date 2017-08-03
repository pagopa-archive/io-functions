/**
 * Defines the database schema for a User
 */

import { Schema } from "mongoose";
import { validateFiscalCode } from "../utils/fiscalcode";

export const userSchema: Schema = new Schema({
  fiscalCode: {
    required: true,
    type: String,
    validate: {
      message: "{VALUE} is not a valid fiscal code.",
      validator: validateFiscalCode,
    },
  },
}, {
  bufferCommands: false, // fail fast, see http://mongoosejs.com/docs/guide.html#bufferCommands
  collection: "users",
  emitIndexErrors: true, // emit error event when index build fails
  read: "nearest",
  timestamps: true, // track createdAt and updatedAt
  versionKey: "version", // track document version
});
