// backend/routes/imageRoutes.js
import express from "express";
import multer from "multer";
import { uploadImage, checkImageSlug, checkImageSlugsBulk, getPublicImages, getUserImages } from "../controllers/imageController.js";
import { optionalAuth, authUser } from "../middleware/authUser.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.get("/", getPublicImages);
// authenticated user's images
router.get('/me', authUser, getUserImages);
router.post("/", optionalAuth, upload.single("image"), uploadImage);

// Slug validation endpoints
router.get("/check-slug", checkImageSlug);
router.post("/check-slugs-bulk", express.json(), checkImageSlugsBulk);

export default router;
