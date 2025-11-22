import mongoose, { Schema, model } from "mongoose";

const AlbumSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: {
    type: String,
    default: "",
  },
  authorId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  exposure: {
    type: String,
    enum: ["public", "unlisted", "private"],
    default: "private",
  },
  images: [
    {
      type: Schema.Types.ObjectId,
      ref: "Image",
    },
  ],
});

export default model("Album", AlbumSchema);
