import express from "express";
import { signup, login } from "../controllers/authController.js";
import { authUser } from "../middleware/authUser.js";
import User from "../models/User.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/me", authUser, async (req, res) => {
  const user = await User.findById(req.user.user_id).select("-password_hash");
  res.json(user);
});

export default router;
