import express from "express";
import { listAlbums, checkAlbumSlug } from "../controllers/albumController.js";

const router = express.Router();

router.get("/", listAlbums);
router.get("/check-slug", checkAlbumSlug);

export default router;
