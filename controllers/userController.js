import User from "../models/User.js";
import bcrypt from "bcrypt";
import { UserService } from "../service/userService.js";
const userService = new UserService();

export async function updateProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "missing_user" });

  try {
    const updates = req.body || {};
    const updated = await userService.updateProfile(userId, updates);
    return res.json({ user: updated });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

export async function changePassword(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "missing_user" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "missing_fields" });

  try {
    const user = await User.get(userId);
    if (!user) return res.status(404).json({ message: "user_not_found" });

    const match = await bcrypt.compare(currentPassword, user.hashedPassword || "");
    if (!match) return res.status(401).json({ message: "incorrect_current_password" });

    await userService.updateProfile(userId, { password: newPassword });
    return res.json({ message: "password_changed" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}
