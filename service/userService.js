import User from "../models/User.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const SALT_ROUNDS = 12;

export class UserService {
  async register(data) {
    console.log("🔍 register() received:", data);

    const { username, fullname, password, authMethod } = data;

    const existing = await User.query("username").eq(username).exec();
    if (existing.length > 0) throw new Error("Username đã tồn tại");

    let hashedPassword;

    if (!authMethod && password) {
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await User.create({
      userId: uuidv4(),
      username,
      fullname,
      hashedPassword,
      authMethod,
    });

    return this._sanitize(user);
  }

  async login(username, password) {
    const result = await User.query("username").eq(username).exec();
    const user = result[0];

    if (!user || user.status !== "active")
      throw new Error("Tài khoản không tồn tại hoặc bị khóa");

    if (user.authMethod)
      throw new Error(`Vui lòng đăng nhập bằng ${user.authMethod}`);

    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match) throw new Error("Mật khẩu sai");

    return this._sanitize(user);
  }

  async updateProfile(userId, updates) {
    const allowed = ["username", "password", "avatarUrl", "fullname"];
    const filtered = {};

    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    if (filtered.username) {
      const exists = await User.query("username").eq(filtered.username).exec();
      if (exists.some((u) => u.userId !== userId))
        throw new Error("Username đã được sử dụng");
    }

    if (filtered.password) {
      filtered.hashedPassword = await bcrypt.hash(filtered.password, SALT_ROUNDS);
      delete filtered.password;
    }

    const updated = await User.update({ userId }, filtered);
    if (!updated) throw new Error("User không tồn tại");

    return this._sanitize(updated);
  }

  async softDelete(userId) {
    const updated = await User.update({ userId }, { status: "deleted" });
    if (!updated) throw new Error("User không tồn tại");
    return this._sanitize(updated);
  }

  async hardDelete(userId) {
    const current = await User.get(userId);
    if (!current) throw new Error("User không tồn tại");

    await User.delete({ userId });
    return { message: "Xóa user vĩnh viễn thành công" };
  }

  async findById(userId) {
    const user = await User.get(userId);
    if (!user) throw new Error("User không tồn tại");
    return this._sanitize(user);
  }

  async findByUsername(username) {
    const result = await User.query("username").eq(username).exec();
    const user = result[0];

    if (!user) throw new Error("User không tồn tại");
    return this._sanitize(user);
  }

  _sanitize(user) {
    const obj = { ...user };
    delete obj.hashedPassword;
    return obj;
  }
}
