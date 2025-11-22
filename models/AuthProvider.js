import mongoose, { Schema, model } from "mongoose";

const AuthProviderSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    enum: ["google", "github", "microsoft", "apple"],
    required: true,
  },
  providerUserId: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    default: null,
  },
  refreshToken: {
    type: String,
    default: null,
  },
  expiredAt: {
    type: Date,
    default: null,
  },
});

AuthProviderSchema.index({ userId: 1, provider: 1 }, { unique: true });
AuthProviderSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

export default model("AuthProvider", AuthProviderSchema);
