import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { connectDB } from "./config/db.js";
import textPasteRoutes from "./routes/textPasteRoutes.js";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import oauthRoutes from "./routes/authOAuth.js";
import passport from "passport";
import imageRoutes from "./routes/imageRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(passport.initialize());

// DB
connectDB();

app.use("/api/auth/oauth", oauthRoutes);
app.use("/paste", textPasteRoutes);
app.use("/api/auth", authRoutes);
app.get("/health", (req, res) => res.send("OK"));
app.use("/api/images", imageRoutes);

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BACKEND_URL: ${BACKEND_URL}`);
});
