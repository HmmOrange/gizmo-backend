import Paste from '../models/TextPaste.js';
import Image from '../models/Image.js';
import Album from '../models/Album.js';
import Bookmark from '../models/Bookmark.js';
import User from '../models/User.js';

export const getGlobalStats = async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Pastes stats (Dynamoose: scan and compute in JS)
    const allPastes = await Paste.scan().exec();
    const totalPastes = Array.isArray(allPastes) ? allPastes.length : 0;
    const pastesToday = (Array.isArray(allPastes) ? allPastes : [])
      .filter(p => p.createdAt && new Date(p.createdAt) >= twentyFourHoursAgo).length;

    // Images stats
    const totalImages = await Image.countDocuments({ dateDeleted: { $exists: false } });
    const imagesToday = await Image.countDocuments({
      dateDeleted: { $exists: false },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Albums stats
    const totalAlbums = await Album.countDocuments({ dateDeleted: { $exists: false } });
    const albumsToday = await Album.countDocuments({
      dateDeleted: { $exists: false },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Views stats (sum views from scanned pastes)
    const totalPasteViews = (Array.isArray(allPastes) ? allPastes : [])
      .reduce((acc, p) => acc + (Number(p.views) || 0), 0);

    const imageViewsAgg = await Image.aggregate([
      { $match: { dateDeleted: { $exists: false } } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const totalImageViews = imageViewsAgg[0]?.totalViews || 0;

    const totalPasteViewsToday = (Array.isArray(allPastes) ? allPastes : [])
      .filter(p => p.createdAt && new Date(p.createdAt) >= twentyFourHoursAgo)
      .reduce((acc, p) => acc + (Number(p.views) || 0), 0);

    const imageViewsTodayAgg = await Image.aggregate([
      { $match: { dateDeleted: { $exists: false }, createdAt: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const totalImageViewsToday = imageViewsTodayAgg[0]?.totalViews || 0;

    // Bookmarks stats
    const totalBookmarks = await Bookmark.countDocuments();
    const bookmarksToday = await Bookmark.countDocuments({
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Users stats (Dynamoose model) - scan and count
    const allUsers = await User.scan().exec();
    const totalUsers = Array.isArray(allUsers) ? allUsers.length : 0;

    res.json({
      pastes: {
        allTime: totalPastes,
        last24h: pastesToday
      },
      images: {
        allTime: totalImages,
        last24h: imagesToday
      },
      albums: {
        allTime: totalAlbums,
        last24h: albumsToday
      },
      views: {
        allTime: totalPasteViews + totalImageViews,
        last24h: totalPasteViewsToday + totalImageViewsToday
      },
      bookmarks: {
        allTime: totalBookmarks,
        last24h: bookmarksToday
      },
      users: {
        total: totalUsers
      }
    });
  } catch (err) {
    console.error('getGlobalStats error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getUserBookmarks = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const bookmarks = await Bookmark.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Organize bookmarks by type and fetch details
    const images = [];
    const albums = [];
    const pastes = [];

    for (const bm of bookmarks) {
      if (bm.targetType === 'image') {
        const img = await Image.findById(bm.targetId).lean();
        if (img) images.push({ ...img, bookmarkedAt: bm.createdAt });
      } else if (bm.targetType === 'album') {
        const alb = await Album.findById(bm.targetId).lean();
        if (alb) albums.push({ ...alb, bookmarkedAt: bm.createdAt });
      } else if (bm.targetType === 'paste') {
        // For Dynamoose model with slug as hashKey, use get
        try {
          const pasteItem = await Paste.get(bm.targetId);
          if (pasteItem) pastes.push({ ...pasteItem, bookmarkedAt: bm.createdAt });
        } catch (e) {
          // ignore missing paste
        }
      }
    }

    res.json({
      images,
      albums,
      pastes
    });
  } catch (err) {
    console.error('getUserBookmarks error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getTopItems = async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '10', 10));
    // Pastes by views (Dynamoose)
    const allPastes = await Paste.scan().exec();
    const pastesArray = Array.isArray(allPastes) ? allPastes : [];
    const topPastesByViews = pastesArray
      .slice()
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
      .slice(0, limit)
      .map(p => ({ slug: p.slug, title: p.title, views: p.views || 0, bookmarks: p.bookmarks || 0, updatedAt: p.updatedAt || p.createdAt }));

    // Pastes by bookmarks: use Bookmark collection aggregation
    const pasteBookmarksAgg = await Bookmark.aggregate([
      { $match: { targetType: 'paste' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    const topPastesByBookmarks = [];
    for (const row of pasteBookmarksAgg) {
      try {
        const p = await Paste.get(row._id);
        if (p) topPastesByBookmarks.push({ slug: p.slug, title: p.title, bookmarks: row.count, views: p.views || 0, updatedAt: p.updatedAt || p.createdAt });
      } catch (e) {
        // ignore missing paste
      }
    }

    // Images by views
    const topImagesByViewsDocs = await Image.find({}).sort({ views: -1 }).limit(limit).lean();
    const topImagesByViews = topImagesByViewsDocs.map(i => ({ _id: i._id, slug: i.slug, caption: i.caption, views: i.views || 0, bookmarkCount: i.bookmarkCount || 0, updatedAt: i.updatedAt || i.createdAt }));

    // Images by bookmarks via Bookmark aggregation
    const imageBookmarksAgg = await Bookmark.aggregate([
      { $match: { targetType: 'image' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    const topImagesByBookmarks = [];
    for (const row of imageBookmarksAgg) {
      const img = await Image.findById(row._id).lean();
      if (img) topImagesByBookmarks.push({ _id: img._id, slug: img.slug, caption: img.caption, bookmarks: row.count, views: img.views || 0, updatedAt: img.updatedAt || img.createdAt });
    }

    // Albums by views: aggregate image views per album
    const albumViewsAgg = await Image.aggregate([
      { $match: { albumId: { $exists: true, $ne: null } } },
      { $group: { _id: '$albumId', totalViews: { $sum: '$views' } } },
      { $sort: { totalViews: -1 } },
      { $limit: limit }
    ]);
    const topAlbumsByViews = [];
    for (const row of albumViewsAgg) {
      const alb = await Album.findById(row._id).lean();
      if (alb) topAlbumsByViews.push({ _id: alb._id, slug: alb.slug, name: alb.name, views: row.totalViews || 0, updatedAt: alb.updatedAt || alb.createdAt });
    }

    // Albums by bookmarks
    const albumBookmarksAgg = await Bookmark.aggregate([
      { $match: { targetType: 'album' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    const topAlbumsByBookmarks = [];
    for (const row of albumBookmarksAgg) {
      const alb = await Album.findById(row._id).lean();
      if (alb) topAlbumsByBookmarks.push({ _id: alb._id, slug: alb.slug, name: alb.name, bookmarks: row.count, updatedAt: alb.updatedAt || alb.createdAt });
    }

    return res.json({
      pastesByViews: topPastesByViews,
      pastesByBookmarks: topPastesByBookmarks,
      imagesByViews: topImagesByViews,
      imagesByBookmarks: topImagesByBookmarks,
      albumsByViews: topAlbumsByViews,
      albumsByBookmarks: topAlbumsByBookmarks,
    });
  } catch (err) {
    console.error('getTopItems error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
