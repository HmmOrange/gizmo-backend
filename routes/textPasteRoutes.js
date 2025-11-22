import express from "express";
import { createPaste, getPublicPastes, getPasteById, exportPaste, summarizePaste, updatePaste } from "../controllers/textPasteController.js";
import { authUser, optionalAuth } from "../middleware/authUser.js";

const app = express.Router();

app.use(express.json());

app.post('/', optionalAuth, createPaste);
app.get('/', getPublicPastes);
app.get('/:id', optionalAuth, getPasteById);
app.patch('/:id', authUser, updatePaste);
app.get('/:id/export', optionalAuth, exportPaste);
app.get("/:id/summary", optionalAuth, summarizePaste);


export default app;