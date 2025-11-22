import express from "express";
import { listAlbums, checkAlbumSlug } from "../controllers/albumController.js";

const router = express.Router();

router.get("/", listAlbums);

export default router;
