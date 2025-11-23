// backend/routes/imageRoutes.js
import express from "express";
import multer from "multer";
import { uploadImage, checkImageSlug, checkImageSlugsBulk } from "../controllers/imageController.js";
import { optionalAuth } from "../middleware/authUser.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", optionalAuth, upload.single("image"), uploadImage);

// Slug validation endpoints
router.get("/check-slug", checkImageSlug);
router.post("/check-slugs-bulk", express.json(), checkImageSlugsBulk);

export default router;