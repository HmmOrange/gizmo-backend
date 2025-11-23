import mongoose, { Schema, model } from "mongoose";

const ImageSchema = new Schema(
  {
    caption: { type: String, default: "" },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    imageUrl: { type: String, required: true },
    imageSize: { type: Number, required: true },
    imageType: {
      type: String,
      enum: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"],
      required: true,
    },
    hashedPassword: { type: String, default: null },
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
    albumId: {
      type: Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },
  },
  { timestamps: true }
);

ImageSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

export default model("Image", ImageSchema);
