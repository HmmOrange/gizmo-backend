import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AuthProvider from "../models/AuthProvider.js";

const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: "https://login.microsoftonline.com/consumers",
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

console.log("🔧 MSAL CONFIG LOADED:");
console.log({
  clientId: msalConfig.auth.clientId,
  authority: msalConfig.auth.authority,
  redirectUri: `${BACKEND_URL}/api/auth/oauth/microsoft/callback`,
});

const pca = new ConfidentialClientApplication(msalConfig);

// Enable verbose MSAL logging
pca.getLogger().infoEnabled = true;
pca.getLogger().verboseEnabled = true;
pca.getLogger().warningEnabled = true;
pca.getLogger().errorEnabled = true;

export async function redirectToMicrosoft(req, res) {
  console.log("\n📍 [STEP 1] redirectToMicrosoft HIT");

  const authCodeUrlParameters = {
    scopes: ["openid", "profile", "email"],
    redirectUri: `${BACKEND_URL}/api/auth/oauth/microsoft/callback`,
    prompt: "select_account",
  };

  console.log("➡️ Generating Auth URL with params:", authCodeUrlParameters);

  try {
    const authUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
    console.log("🔗 Auth URL Generated:", authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error("❌ ERROR generating Microsoft auth URL:", error);
    res.status(500).send("Auth redirect failed");
  }
}

export async function handleMicrosoftCallback(req, res) {
  console.log("\n📍 [STEP 2] Callback HIT");
  console.log("🌐 Raw Query Params:", req.query);

  if (!req.query.code) {
    console.log("❌ No `code` received in callback. Something is wrong.");
    return res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
  }

  const tokenRequest = {
    code: req.query.code,
    redirectUri: `${BACKEND_URL}/api/auth/oauth/microsoft/callback`,
    scopes: ["openid", "profile", "email"],
  };

  console.log("➡️ Token request object:", tokenRequest);

  try {
    const response = await pca.acquireTokenByCode(tokenRequest);

    console.log("🎉 Token successfully acquired from Microsoft:");
    console.log({
      uniqueId: response.uniqueId,
      username: response.account?.username,
      idTokenClaims: response.idTokenClaims,
    });

    const microsoftId = response.uniqueId;
    const email = response.account.username;

    console.log(
      `🔎 Searching for AuthProvider (provider=microsoft, providerUserId=${microsoftId})`
    );

    let provider = await AuthProvider.findOne({
      provider: "microsoft",
      providerUserId: microsoftId,
    });

    let user;

    if (!provider) {
      console.log("⚠️ No provider found. Checking if user exists...");

      user = await User.findOne({ username: email });

      if (!user) {
        console.log("🆕 Creating new user for Microsoft login:", email);
        user = await User.create({
          username: email,
          hashedPassword: null,
          authMethod: "microsoft",
        });
      } else {
        console.log("✔ Found existing user:", user.username);
      }

      console.log("🆕 Linking Microsoft account to user...");
      provider = await AuthProvider.create({
        userId: user._id,
        provider: "microsoft",
        providerUserId: microsoftId,
      });
    } else {
      console.log("✔ Provider exists; retrieving linked user...");
      user = await User.findById(provider.userId);
    }

    console.log("🔐 Generating JWT for:", user.username);

    const jwtToken = jwt.sign(
      { user_id: user._id, username: email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("🎫 JWT Created:", jwtToken);

    res.redirect(`${FRONTEND_URL}/auth/success?token=${encodeURIComponent(jwtToken)}`);
  } catch (error) {
    console.error("\n❌ FATAL OAUTH ERROR in callback:");
    console.error(error);

    return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
}
