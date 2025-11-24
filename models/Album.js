import dynamoose from "../db/dynamo.js";

const AlbumSchema = new dynamoose.Schema({
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
    default: null,
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
      type: String,
      ref: "Image",
    },
  ],
});

export default dynamoose.model("Album", AlbumSchema);
