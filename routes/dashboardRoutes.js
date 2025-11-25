import express from 'express';
import { getGlobalStats, getUserBookmarks } from '../controllers/dashboardController.js';
import { optionalAuth, authUser } from '../middleware/authUser.js';

const router = express.Router();

// Global stats - accessible to everyone
router.get('/stats', optionalAuth, getGlobalStats);

// User bookmarks - requires authentication
router.get('/bookmarks', authUser, getUserBookmarks);

export default router;
