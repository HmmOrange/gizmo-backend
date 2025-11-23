// backend/routes/imageRoutes.js
import express from "express";
import multer from "multer";
import { uploadImage, checkImageSlug, checkImageSlugsBulk } from "../controllers/imageController.js";
import { optionalAuth } from "../middleware/authUser.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", optionalAuth, upload.single("image"), uploadImage);

export default router;