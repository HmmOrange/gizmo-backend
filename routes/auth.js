import express from "express";
import { signup, login } from "../controllers/authController.js";
import { authUser } from "../middleware/authUser.js";
import User from "../models/User.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  // console.log("📩 Incoming /signup request body:", req.body);

  try {
    const result = await signup(req, res);
    // console.log("✅ Signup success:", result);
  } catch (err) {
    // console.error("❌ Signup error:", err);
    res.status(400).json({ message: err.message });
  }
});

router.post("/login", login);

router.get("/me", authUser, async (req, res) => {
  const user = await User.findById(req.user.user_id).select("-password_hash");
  res.json(user);
});

export default router;
