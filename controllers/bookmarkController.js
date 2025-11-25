import Bookmark from '../models/Bookmark.js';
import Image from '../models/Image.js';
import Album from '../models/Album.js';
import Paste from '../models/TextPaste.js';

export const toggleBookmark = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const { targetType, targetId } = req.body;
        if (!["image", "album", "paste"].includes(targetType))
            return res.status(400).json({ message: "Invalid targetType" });
        if (!targetId) return res.status(400).json({ message: "Missing targetId" });

        // --- ensure target exists ---
        if (targetType === "image") {
            const img = await Image.findById(targetId).select("_id");
            if (!img) return res.status(404).json({ message: "Image not found" });
        } else if (targetType === "album") {
            const alb = await Album.findById(targetId).select("_id");
            if (!alb) return res.status(404).json({ message: "Album not found" });
        } else if (targetType === "paste") {
            try {
                const paste = await Paste.get(targetId);
                if (!paste) return res.status(404).json({ message: "Paste not found" });
            } catch {
                return res.status(404).json({ message: "Paste not found" });
            }
        }

        // --- CREATE BOOKMARK ---
        try {
            const bm = await Bookmark.create({ userId, targetType, targetId });

            // increase counters
            if (targetType === "image") {
                console.log("Incrementing image bookmarks for", targetId);
                await Image.findByIdAndUpdate(targetId, { $inc: { bookmarks: 1 } });
            } else if (targetType === "album") {
                await Album.findByIdAndUpdate(targetId, { $inc: { bookmarks: 1 } });
            } else if (targetType === "paste") {
                try {
                    await Paste.update({ slug: targetId }, { $ADD: { bookmarks: 1 } });
                } catch (e) {
                    console.warn("Failed to increment paste.bookmarks:", e);
                }
            }

            const count = await Bookmark.countDocuments({ targetType, targetId });
            return res.json({ bookmarked: true, count });

        } catch (err) {
            // --- DELETE BOOKMARK (duplicate key) ---
            if (err.code === 11000) {
                await Bookmark.deleteOne({ userId, targetType, targetId });

                // decrease counters
                if (targetType === "image") {
                    console.log("Decrementing image bookmarks for", targetId);
                    await Image.findByIdAndUpdate(targetId, { $inc: { bookmarks: -1 } });
                } else if (targetType === "album") {
                    await Album.findByIdAndUpdate(targetId, { $inc: { bookmarks: -1 } });
                } else if (targetType === "paste") {
                    try {
                        await Paste.update({ slug: targetId }, { $ADD: { bookmarks: -1 } });
                    } catch (e) {
                        console.warn("Failed to decrement paste.bookmarks:", e);
                    }
                }

                const count = await Bookmark.countDocuments({ targetType, targetId });
                return res.json({ bookmarked: false, count });
            }

            throw err;
        }
    } catch (err) {
        console.error("toggleBookmark error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const getBookmarks = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        const { type } = req.query; // optional filter image|album
        const q = { userId };
        if (type === 'image' || type === 'album') q.targetType = type;

        const items = await Bookmark.find(q).sort({ createdAt: -1 }).lean();
        return res.json({ bookmarks: items });
    } catch (err) {
        console.error('getBookmarks error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const checkBookmark = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { targetType, targetId } = req.query;
        if (!targetType || !targetId) return res.status(400).json({ message: 'Missing params' });
        if (!userId) return res.json({ bookmarked: false });
        const exists = await Bookmark.findOne({ userId, targetType, targetId });
        return res.json({ bookmarked: !!exists });
    } catch (err) {
        console.error('checkBookmark error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
