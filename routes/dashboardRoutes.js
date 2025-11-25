import express from 'express';
import { getGlobalStats, getUserBookmarks, getTopItems } from '../controllers/dashboardController.js';
import { optionalAuth, authUser } from '../middleware/authUser.js';

const router = express.Router();

// Global stats - accessible to everyone
router.get('/stats', optionalAuth, getGlobalStats);

// Top leaderboards
router.get('/top', optionalAuth, getTopItems);

// User bookmarks - requires authentication
router.get('/bookmarks', authUser, getUserBookmarks);

export default router;
