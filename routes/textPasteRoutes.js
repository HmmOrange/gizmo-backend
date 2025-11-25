import express from "express";
import { createPaste, getPublicPastes, getPasteById, exportPaste, summarizePaste, updatePaste, searchPastes } from "../controllers/textPasteController.js";
import { authUser, optionalAuth } from "../middleware/authUser.js";

const router = express.Router();

router.use(express.json());

router.get("/search", searchPastes);
router.post('/', optionalAuth, createPaste);
router.get('/', getPublicPastes);
router.get('/:id', optionalAuth, getPasteById);
router.patch('/:id', authUser, updatePaste);
router.get('/:id/export', optionalAuth, exportPaste);
router.get("/:id/summary", optionalAuth, summarizePaste);



export default router;
