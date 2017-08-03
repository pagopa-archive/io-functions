/**
 * Defines the database schema for a User
 */

import { Schema } from "mongoose";

export const userSchema: Schema = new Schema({
  fiscalCode: String,
  version: { type: Number, default: 0 },
}, {
  bufferCommands: false, // fail fast, see http://mongoosejs.com/docs/guide.html#bufferCommands
  collection: "users",
  emitIndexErrors: true, // emit error event when index build fails
  read: "nearest",
  timestamps: true, // track createdAt and updatedAt
  versionKey: "version", // track document version
});
