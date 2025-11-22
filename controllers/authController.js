import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function signup(req, res) {
  const { username, password, name } = req.body;

  if (!username || !password || !name)
  return res.status(400).json({ message: "missing_fields" });

  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(409).json({ message: "username_taken" });
  }

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    username,
    name,
    hashedPassword: hash,
    authMethod: null,   // explicit so format stays consistent
    storageUsed: 0,     // optional since default exists
  });


  return res.status(201).json({ message: "account_created" });
}

export async function login(req, res) {
  const { username, password } = req.body;

  console.log("BODY:", req.body);

  const user = await User.findOne({ username });

  console.log("FOUND USER:", user);

  if (!user) {
    return res.status(401).json({ message: "invalid_credentials" });
  }

  const match = await bcrypt.compare(password, user.hashedPassword);
  if (!match) {
    return res.status(401).json({ message: "invalid_credentials" });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET is not set in environment variables");
    return res.status(500).json({ message: "server_error" });
  }

  const token = jwt.sign(
    { user_id: user._id, username: user.username },
    jwtSecret,
    { expiresIn: "7d" }
  );

  return res.json({ token });
}
