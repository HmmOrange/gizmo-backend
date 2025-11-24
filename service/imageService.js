import Image from "../models/Image.js";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

const SALT_ROUNDS = 12;

export class ImageService {
  async createImage(data, userId = null) {
    const {
      caption = "",
      imageUrl,
      imageSize,
      imageType,
      exposure = "public",
      password,
      albumId,
      expiredAt,
      slug: customSlug,
      isCustomSlug = false,
    } = data;

    if (!imageUrl || !imageSize || !imageType) {
      throw new Error("Missing image information");
    }

    let slug;
    if (customSlug?.trim()) {
      const wanted = customSlug.trim();
      if (isCustomSlug) {
        const exists = await Image.findOne({ slug: wanted });
        if (exists) {
          const err = new Error("Slug already in use");
          err.code = "SLUG_TAKEN";
          throw err;
        }
        slug = wanted;
      } else {
        // preferred slug provided but not user-customized: try to find an available variant
        let candidate = wanted;
        let counter = 0;
        while (await Image.findOne({ slug: candidate })) {
          counter += 1;
          candidate = `${wanted}-${counter}`;
          if (counter > 500) break;
        }
        slug = candidate;
      }
    } else {
      slug = nanoid(10);
      while (await Image.findOne({ slug })) {
        slug = nanoid(10);
      }
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, SALT_ROUNDS)
      : null;

    if (exposure === "private" && !userId) {
      throw new Error("Private images require login");
    }

    const image = new Image({
      caption: caption.trim(),
      slug,
      imageUrl,
      imageSize,
      imageType,
      exposure,
      hashedPassword,
      expiredAt: expiredAt ? new Date(expiredAt) : null,
      authorId: exposure === "private" ? userId : userId || null,
      albumId: albumId || null,
    });

    await image.save();
    return this._sanitize(image, userId);
  }

  async generateUniqueSlug(preferred, isCustom = false) {
    const base = preferred?.trim();
    if (base) {
      if (isCustom) {
        const exists = await Image.findOne({ slug: base });
        if (exists) {
          const err = new Error("Slug already in use");
          err.code = "SLUG_TAKEN";
          throw err;
        }
        return base;
      }

      let candidate = base;
      let counter = 0;
      while (await Image.findOne({ slug: candidate })) {
        counter += 1;
        candidate = `${base}-${counter}`;
        if (counter > 500) break;
      }
      return candidate;
    }

    let slug = nanoid(10);
    while (await Image.findOne({ slug })) {
      slug = nanoid(10);
    }
    return slug;
  }

  async getImageById(id, userId = null, password = null) {
    const image = await Image.findById(id);
    if (!image) throw new Error("Image does not exist");
    await this._checkExpired(image);
    await this.canAccessImage(image, userId, password);
    await this.incrementViews(image._id);
    return this._sanitize(image, userId);
  }

  async getImageBySlug(slug, password = null) {
    const image = await Image.findOne({ slug });
    if (!image) throw new Error("Image does not exist");
    await this._checkExpired(image);
    await this.canAccessImage(image, null, password);
    await this.incrementViews(image._id);
    return this._sanitize(image);
  }

  async incrementViews(id) {
    await Image.findByIdAndUpdate(id, { $inc: { views: 1 } });
  }

  async updateImage(id, updates, userId) {
    const image = await Image.findById(id);
    if (!image) throw new Error("Image does not exist");
    if (image.authorId && image.authorId.toString() !== userId) {
      throw new Error("No permission");
    }

    const allowed = ["caption", "exposure", "albumId", "expiredAt", "password"];
    const filtered = {};

    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    if (filtered.password !== undefined) {
      filtered.hashedPassword = filtered.password
        ? await bcrypt.hash(filtered.password, SALT_ROUNDS)
        : null;
      filtered.exposure = filtered.password ? "password_protected" : "public";
      delete filtered.password;
    }

    if (filtered.expiredAt !== undefined) {
      filtered.expiredAt = filtered.expiredAt
        ? new Date(filtered.expiredAt)
        : null;
    }

    if (filtered.albumId !== undefined) {
      filtered.albumId = filtered.albumId || null;
    }

    Object.assign(image, filtered);
    await image.save();
    return this._sanitize(image, userId);
  }

  async setPassword(id, newPassword, userId) {
    const image = await Image.findById(id);
    if (!image) throw new Error("Image does not exist");
    if (image.authorId && image.authorId.toString() !== userId) {
      throw new Error("No permission");
    }
    image.hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    image.exposure = "password_protected";
    await image.save();
  }

  async deleteImage(id, userId) {
    const image = await Image.findById(id);
    if (!image) return; // already deleted
    if (image.authorId && image.authorId.toString() !== userId) {
      throw new Error("No permission to delete");
    }
    await image.deleteOne();
  }

  async canAccessImage(image, userId = null, password = null) {
    const isOwner = userId && image.authorId?.toString() === userId;

    if (image.exposure === "public") return true;
    if (image.exposure === "unlisted") return true;
    if (image.exposure === "private" && isOwner) return true;
    if (image.exposure === "password_protected") {
      if (!image.hashedPassword) throw new Error("This image does not have a password set");
      if (!password) throw new Error("Password required");
      let match = false;
      try {
        match = await bcrypt.compare(password, image.hashedPassword);
      } catch (err) {
        throw new Error("Password authentication error");
      }
      if (!match) throw new Error("Incorrect password");
      return true;
    }
    throw new Error("You do not have permission to view this image");
  }

  async listUserImages(userId, options = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
    const images = await Image.find({ authorId: userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    return images.map((img) => this._sanitize(img, userId));
  }

  async listImagesInAlbum(albumId, userId = null, options = {}) {
    const { limit = 50, skip = 0 } = options;
    const images = await Image.find({ albumId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return images
      .filter((img) => {
        if (img.exposure === "private")
          return userId && img.authorId?.toString() === userId;
        if (img.exposure === "password_protected") return false; // không list nếu có pass
        return true;
      })
      .map((img) => this._sanitize(img, userId));
  }

  async searchImages(query, options = {}) {
    const { limit = 20, skip = 0 } = options;
    if (!query?.trim()) return { images: [], total: 0 };

    const regex = new RegExp(query.trim(), "i");
    const match = {
      $or: [{ caption: regex }],
      exposure: { $in: ["public", "unlisted"] },
    };

    const [images, total] = await Promise.all([
      Image.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Image.countDocuments(match),
    ]);

    return {
      images: images.map((img) => this._sanitize(img)),
      total,
      skip,
      limit,
    };
  }

  async moveImageToAlbum(imageId, albumId, userId) {
    const image = await Image.findById(imageId);
    if (!image) throw new Error("Image does not exist");
    if (image.authorId && image.authorId.toString() !== userId) {
      throw new Error("No permission");
    }
    image.albumId = albumId || null;
    await image.save();
    return this._sanitize(image, userId);
  }

  async _checkExpired(image) {
    if (image.expiredAt && image.expiredAt < new Date()) {
      await image.deleteOne();
      throw new Error("Image has expired");
    }
  }

  _sanitize(image, viewerId = null) {
    const obj = image.toObject ? image.toObject() : image;
    const isOwner = viewerId && obj.authorId?.toString() === viewerId;

    return {
      _id: obj._id,
      caption: obj.caption,
      slug: obj.slug,
      imageUrl: obj.imageUrl,
      imageSize: obj.imageSize,
      imageType: obj.imageType,
      exposure: obj.exposure,
      views: obj.views,
      createdAt: obj.createdAt,
      expiredAt: obj.expiredAt,
      authorId: isOwner ? obj.authorId : null,
      albumId: obj.albumId,
    };
  }
}
