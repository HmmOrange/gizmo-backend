import express from "express";
import { authUser } from "../middleware/authUser.js";
import { updateProfile, changePassword } from "../controllers/userController.js";

const router = express.Router();

// Update profile fields (fullname, username, avatarUrl)
router.patch('/profile', authUser, updateProfile);

// Change password (requires currentPassword and newPassword)
router.post('/password', authUser, changePassword);

export default router;
