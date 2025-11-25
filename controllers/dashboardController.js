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
