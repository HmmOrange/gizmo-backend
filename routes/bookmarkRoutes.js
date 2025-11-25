import express from 'express';
import { toggleBookmark, getBookmarks, checkBookmark } from '../controllers/bookmarkController.js';
import { optionalAuth } from '../middleware/authUser.js';

const router = express.Router();

// toggle requires auth
router.post('/toggle', optionalAuth, toggleBookmark);
router.get('/', optionalAuth, getBookmarks);
router.get('/check', optionalAuth, checkBookmark);

export default router;
