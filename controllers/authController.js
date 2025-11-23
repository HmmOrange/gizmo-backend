import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserService } from "../service/userService.js";

const userService = new UserService();

export async function signup(req, res) {
  const { username, password, fullname, authMethod } = req.body;

  if (!username || !password || !fullname) {
    return res.status(400).json({ message: "missing_fields" });
  }

  try {
    const payload = { username, password, fullname };
    if (typeof authMethod === "string") payload.authMethod = authMethod;

    const user = await userService.register(payload);

    return res.status(201).json({ message: "account_created", user });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;

  try {
    const user = await userService.login(username, password);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: "server_error" });
    }

    const token = jwt.sign(
      { user_id: user.userId, username: user.username },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.json({ token, user });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
}
