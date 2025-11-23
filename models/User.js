import dynamoose from "../db/dynamo.js";

const UserSchema = new dynamoose.Schema(
  {
    userId: {
      type: String,
      hashKey: true,
    },
    username: {
      type: String,
      required: true,
      index: {
        name: "usernameGlobalIndex",
        type: "global",
      },
    },
    fullname: {
      type: String,
      required: true,
    },
    hashedPassword: {
      type: String,
    },
    avatarUrl: {
      type: String,
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    maxStorage: {
      type: Number,
      default: 1024 * 1024 * 1024,
    },
    status: {
      type: String,
      enum: ["active", "banned", "deleted"],
      default: "active",
    },
    authMethod: {
      type: String,
      enum: ["google", "github", "microsoft", "apple"],
      default: undefined,
      required: false,
    },


  },
  {
    timestamps: true,
  }
);

export default dynamoose.model("Users", UserSchema);
