import express from "express";
import { shareAlbum, shareImage } from "../controllers/shareController.js";
import { optionalAuth } from "../middleware/authUser.js";

const router = express.Router();

router.get("/album/:slug", optionalAuth, shareAlbum);
// Single image share endpoint: always access images by their slug
router.get("/image/:slug", optionalAuth, shareImage);

export default router;
