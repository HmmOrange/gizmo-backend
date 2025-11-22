import Album from "../models/Album.js";

export const listAlbums = async (req, res) => {
  try {
    // Return latest 100 albums (for simplicity). In future filter by user/public.
    const albums = await Album.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const sanitized = albums.map(a => ({ _id: a._id, name: a.name, slug: a.slug, description: a.description, exposure: a.exposure }));
    res.json({ albums: sanitized });
  } catch (err) {
    console.error("List albums error:", err);
    res.status(500).json({ message: "Could not list albums" });
  }
};

export const checkAlbumSlug = async (req, res) => {
  try {
    const slug = (req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ available: false, message: "Missing slug" });
    const existing = await Album.findOne({ slug });
    return res.json({ available: !existing });
  } catch (err) {
    console.error("checkAlbumSlug error:", err);
    res.status(500).json({ available: false, message: "Server error" });
  }
};
