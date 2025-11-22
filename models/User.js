import mongoose, { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // minlength: 3,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hashedPassword: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    storageUsed: { type: Number, default: 0, min: 0 },
    maxStorage: { type: Number, default: 1024 * 1024 * 1024 },
    status: {
      type: String,
      enum: ["active", "banned", "deleted"],
      default: "active",
    },
    authMethod: {
      type: String,
      enum: [null, "google", "github", "microsoft", "apple"],
      default: null,
    },
  },
  { timestamps: true }
);

export default model("User", UserSchema);
