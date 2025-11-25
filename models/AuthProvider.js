import dynamoose from "../db/dynamo.js";

const AuthProviderSchema = new dynamoose.Schema(
  {
    id: {
      type: String,
      hashKey: true,
    },
    userId: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
      index: {
        name: "providerUserIndex",
        type: "global",
      },
    },
  },
  {
    timestamps: true,
  }
);

export default dynamoose.model("AuthProviders", AuthProviderSchema);
