import Album from "../models/Album.js";
import Image from "../models/Image.js";
import { ImageService } from "../service/imageService.js";
import { optionalAuth } from "../middleware/authUser.js";

const imageService = new ImageService();

export const shareAlbum = async (req, res) => {
  try {
    const slug = (req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ message: "Missing album slug" });
    // Special-case the global 'images' collection: list images without an album
    if (slug === "images") {
      // return public/unlisted images not in any album
      const imgs = await Image.find({ albumId: null, exposure: { $in: ["public", "unlisted"] } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const images = imgs.map((img) => ({
        _id: img._id,
        caption: img.caption,
        slug: img.slug,
        imageUrl: img.imageUrl,
        exposure: img.exposure,
        createdAt: img.createdAt,
      }));

      return res.json({ album: { _id: null, name: "Images", slug: "images", description: "Global images", exposure: "public", images } });
    }

    const album = await Album.findOne({ slug }).populate({ path: 'images' }).lean();
    if (!album) return res.status(404).json({ message: "Album not found" });

    // Access rules: private albums only for owner
    if (album.exposure === "private") {
      // optionalAuth middleware populates req.user when JWT provided
      const userId = req.user?.id || null;
      if (!userId || !album.authorId || String(album.authorId) !== String(userId)) {
        return res.status(403).json({ message: "Album is private" });
      }
    }

    // For unlisted/public, just return album with sanitized images
    const images = (album.images || []).map((img) => ({
      _id: img._id,
      caption: img.caption,
      slug: img.slug,
      imageUrl: img.imageUrl,
      exposure: img.exposure,
      createdAt: img.createdAt,
    }));

    return res.json({ album: { _id: album._id, name: album.name, slug: album.slug, description: album.description, exposure: album.exposure, images } });
  } catch (err) {
    console.error("shareAlbum error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const shareImage = async (req, res) => {
  try {
    // route: /share/image/:slug
    const slug = (req.params.slug || "").trim();
    const password = req.query.password || null;

    if (!slug) return res.status(400).json({ message: "Missing image slug" });

    const image = await Image.findOne({ slug });
    if (!image) return res.status(404).json({ message: "Image not found" });
    // Check for expiration
    await imageService._checkExpired(image);

    // Access check: image exposure governs access regardless of album
    const userId = req.user?.id || null;
    await imageService.canAccessImage(image, userId, password);

    // Increment views and return sanitized
    await imageService.incrementViews(image._id);
    const sanitized = imageService._sanitize(image, userId);
    return res.json({ image: sanitized });
  } catch (err) {
    console.error("shareImage error:", err);
    if (String(err.message).toLowerCase().includes("password")) {
      return res.status(401).json({ message: err.message });
    }
    if (String(err.message).toLowerCase().includes("quyền") || String(err.message).toLowerCase().includes("permission") || String(err.message).toLowerCase().includes("không có quyền")) {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error" });
  }
};
