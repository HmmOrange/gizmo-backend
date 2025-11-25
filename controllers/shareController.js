import Album from "../models/Album.js";
import Image from "../models/Image.js";
import { ImageService } from "../service/imageService.js";
import { optionalAuth } from "../middleware/authUser.js";
import Bookmark from "../models/Bookmark.js";

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
        // For each image compute bookmark count
        const images = [];
        for (const img of (album.images || [])) {
            const count = await Bookmark.countDocuments({ targetType: 'image', targetId: img._id });
            images.push({
                _id: img._id,
                caption: img.caption,
                slug: img.slug,
                imageUrl: img.imageUrl,
                exposure: img.exposure,
                createdAt: img.createdAt,
                bookmarkCount: count,
            });
        }

        // also provide album-level bookmark count
        const albumBookmarkCount = await Bookmark.countDocuments({ targetType: 'album', targetId: album._id });

        return res.json({ album: { _id: album._id, name: album.name, slug: album.slug, description: album.description, exposure: album.exposure, images, bookmarkCount: albumBookmarkCount } });
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
        try {
            await imageService.canAccessImage(image, userId, password);
        } catch (err) {
            // If error is password required, return requirePassword: true
            if (String(err.message).toLowerCase().includes("yêu cầu mật khẩu")) {
                return res.status(200).json({ requirePassword: true, message: "Password required to view this image." });
            }
            // Other permission errors
            if (String(err.message).toLowerCase().includes("quyền") || String(err.message).toLowerCase().includes("permission") || String(err.message).toLowerCase().includes("không có quyền")) {
                return res.status(403).json({ message: "You do not have permission to view this image." });
            }
            if (String(err.message).toLowerCase().includes("password")) {
                return res.status(401).json({ message: err.message });
            }
            return res.status(500).json({ message: "Server error" });
        }

        // Increment views and return sanitized
        await imageService.incrementViews(image._id);
        const sanitized = imageService._sanitize(image, userId);
        // add bookmark info
        const bookmarkCount = await Bookmark.countDocuments({ targetType: 'image', targetId: image._id });
        const userBookmarked = userId ? !!(await Bookmark.findOne({ userId, targetType: 'image', targetId: image._id })) : false;
        sanitized.bookmarkCount = bookmarkCount;
        sanitized.bookmarked = userBookmarked;
        console.log("shareImage:", sanitized);
        return res.json({ image: sanitized });
    } catch (err) {
        console.error("shareImage error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
