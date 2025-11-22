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
import albumRoutes from "./routes/albumRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(passport.initialize());

// Simple request logger for debugging incoming requests
app.use((req, res, next) => {
  try {
    console.log(`>> ${req.method} ${req.originalUrl}`);
  } catch (e) {}
  next();
});

// DB
connectDB();

app.use("/api/auth/oauth", oauthRoutes);
app.use("/paste", textPasteRoutes);
app.use("/api/auth", authRoutes);
app.get("/health", (req, res) => res.send("OK"));

app.use("/api/images", imageRoutes);
app.use("/api/albums", albumRoutes);

// Debug: list mounted routes (for development only)
app.get("/api/debug/routes", (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // routes registered directly on the app
        const methods = Object.keys(middleware.route.methods).join(",");
        routes.push({ path: middleware.route.path, methods });
      } else if (middleware.name === "router") {
        // router middleware
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods).join(",");
            routes.push({ path: handler.route.path, methods });
          }
        });
      }
    });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ message: "Failed to list routes", error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BACKEND_URL: ${BACKEND_URL}`);
  // Log registered routes for debugging
  try {
    console.log('Registered routes:');
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(',');
        console.log(`${methods} ${middleware.route.path}`);
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods).join(',');
            console.log(`${methods} ${handler.route.path}`);
          }
        });
      }
    });
  } catch (e) {
    console.error('Failed to list routes on startup', e);
  }
});
