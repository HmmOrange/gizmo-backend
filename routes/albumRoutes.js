import express from "express";
import { listAlbums, checkAlbumSlug, getUserAlbums } from "../controllers/albumController.js";
import { authUser } from "../middleware/authUser.js";

const router = express.Router();

router.get("/", listAlbums);
router.get("/check-slug", checkAlbumSlug);
router.get('/me', authUser, getUserAlbums);

export default router;
