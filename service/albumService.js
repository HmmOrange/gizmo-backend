import Album from "../models/Album.js";
import { nanoid } from "nanoid";

export class AlbumService {
  async createAlbum(data, userId) {
    const { name, description = "", exposure = "private", slug } = data;

    if (!name?.trim()) {
      throw Error("Tên album là bắt buộc");
    }

    let finalSlug = slug?.trim() || nanoid(12);

    let counter = 0;
    let uniqueSlug = finalSlug;
    while (await Album.findOne({ slug: uniqueSlug })) {
      uniqueSlug = `${finalSlug}-${++counter || ""}`.replace(/-$/, "");
    }

    const album = new Album({
      name: name.trim(),
      slug: uniqueSlug,
      description: description.trim(),
      authorId: userId,
      exposure,
    });

    await album.save();
    return this._sanitize(album);
  }

  async getAlbumById(id, userId = null) {
    const album = await Album.findById(id);
    if (!album) throw Error("Album không tồn tại");

    await this.canAccessAlbum(album, userId);

    return this._sanitize(album);
  }

  async getAlbumBySlug(slug, userId = null) {
    const album = await Album.findOne({ slug });
    if (!album) throw Error("Album không tồn tại");

    await this.canAccessAlbum(album, userId);

    return this._sanitize(album);
  }

  async updateAlbum(albumId, updates, userId) {
    const album = await Album.findById(albumId);
    if (!album) throw Error("Album không tồn tại");

    if (album.authorId !== userId) {
      throw Error("Bạn không có quyền chỉnh sửa album này");
    }

    const allowed = ["name", "description", "exposure", "slug"];
    const filtered = {};

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
      }
    }

    if (filtered.name) {
      filtered.name = filtered.name.trim();
      if (!filtered.slug) {
        filtered.slug = nanoid(12);
      }
    }

    if (filtered.slug && filtered.slug !== album.slug) {
      let newSlug = filtered.slug.trim();
      const existing = await Album.findOne({
        slug: newSlug,
        _id: { $ne: albumId },
      });
      if (existing) throw Error("Slug đã được sử dụng");

      filtered.slug = newSlug;
    }

    Object.assign(album, filtered);
    await album.save();

    return this._sanitize(album);
  }

  async deleteAlbum(albumId, userId) {
    const album = await Album.findById(albumId);
    if (!album) throw Error("Album không tồn tại");

    if (album.authorId !== userId) {
      throw Error("Bạn không có quyền xóa album này");
    }

    await album.deleteOne();
  }

  async canAccessAlbum(album, userId = null) {
    const isOwner = userId && album.authorId === userId;

    if (album.exposure === "public") return true;
    if (album.exposure === "unlisted") return true;
    if (album.exposure === "private" && isOwner) return true;

    throw Error("Bạn không có quyền xem album này");
  }

  async listUserAlbums(userId, options = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;

    const albums = await Album.find({ author: userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return albums.map(this._sanitize);
  }

  async searchAlbums(query, options = {}) {
    const { limit = 20, skip = 0 } = options;
    if (!query?.trim()) return { albums: [], total: 0 };

    const regex = new RegExp(query.trim(), "i");

    const match = {
      $or: [{ name: regex }, { description: regex }],
      exposure: { $in: ["public", "unlisted"] },
    };

    const [albums, total] = await Promise.all([
      Album.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Album.countDocuments(match),
    ]);

    return {
      albums: albums.map(this._sanitize),
      total,
      skip,
      limit,
    };
  }

  _sanitize(album) {
    const obj = album.toObject ? album.toObject() : album;
    return {
      _id: obj._id,
      name: obj.name,
      slug: obj.slug,
      description: obj.description,
      exposure: obj.exposure,
      createdAt: obj.createdAt,
      author: obj.authorId,
    };
  }
}
