import mongoose, { Schema, model } from "mongoose";

const PasteSchema = new Schema(
  {
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    hashedPassword: {
      type: String,
      default: null,
    },
    exposure: {
      type: String,
      enum: ["public", "password_protected", "unlisted", "private"],
      default: "public",
      required: true,
    },
    views: { type: Number, default: 0 },
    expiredAt: { type: Date, default: null },
    authorId: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

PasteSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

export default model("Paste", PasteSchema);
