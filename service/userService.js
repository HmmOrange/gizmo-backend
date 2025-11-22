import User from "../models/User.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export class UserService {
  // --- REGISTER ---
  async register({ username, password, authMethod = null }) {
    const existing = await User.findOne({ username });
    if (existing) throw new Error("Username đã tồn tại");

    let hashedPassword = null;
    if (!authMethod && password) {
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = new User({ username, hashedPassword, authMethod });
    await user.save();
    return this._sanitize(user);
  }

  // --- LOGIN ---
  async login(username, password) {
    const user = await User.findOne({ username });
    if (!user || user.status !== "active")
      throw new Error("Tài khoản không tồn tại hoặc bị khóa");

    if (user.authMethod)
      throw new Error(`Vui lòng đăng nhập bằng ${user.authMethod}`);

    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match) throw new Error("Mật khẩu sai");

    return this._sanitize(user);
  }

  // --- UPDATE PROFILE ---
  async updateProfile(userId, updates) {
    const allowed = ["username", "password", "avatarUrl"];
    const filtered = {};

    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    // Check username duplication
    if (filtered.username) {
      const exist = await User.findOne({
        username: new RegExp(`^${filtered.username}$`, "i"),
        _id: { $ne: userId },
      });
      if (exist) throw new Error("Username đã được sử dụng");
    }

    // Hash password if provided
    if (filtered.password) {
      filtered.hashedPassword = await bcrypt.hash(
        filtered.password,
        SALT_ROUNDS
      );
      delete filtered.password;
    }

    const user = await User.findByIdAndUpdate(userId, filtered, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new Error("User không tồn tại");

    return this._sanitize(user);
  }

  // --- SOFT DELETE ---
  async softDelete(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { status: "deleted" },
      { new: true }
    );
    if (!user) throw new Error("User không tồn tại");
    return this._sanitize(user);
  }

  // --- HARD DELETE ---
  async hardDelete(userId) {
    const result = await User.findByIdAndDelete(userId);
    if (!result) throw new Error("User không tồn tại");
    return { message: "Xóa user vĩnh viễn thành công" };
  }

  // --- FIND ---
  async findById(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User không tồn tại");
    return this._sanitize(user);
  }

  async findByUsername(username) {
    const user = await User.findOne({ username });
    if (!user) throw new Error("User không tồn tại");
    return this._sanitize(user);
  }

  // --- INTERNAL SANITIZE ---
  _sanitize(user) {
    const obj = user.toObject();
    delete obj.hashedPassword;
    return obj;
  }
}
