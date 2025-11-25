import express from "express";
import multer from "multer";
import { readImageOCR } from "../service/visionService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/ocr", upload.single("image"), async (req, res) => {
  try {
    const text = await readImageOCR(req.file.buffer);
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "OCR failed" });
  }
});

export default router;
