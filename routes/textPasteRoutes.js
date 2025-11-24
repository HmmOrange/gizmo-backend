import express from "express";
import { createPaste, getPublicPastes, getPasteById, exportPaste, summarizePaste, updatePaste, favouritePaste, unfavouritePaste, getFavouritePaste } from "../controllers/textPasteController.js";
import { authUser, optionalAuth } from "../middleware/authUser.js";

const app = express.Router();

app.use(express.json());

app.post('/', optionalAuth, createPaste);
app.get('/', getPublicPastes);
app.get('/:id', optionalAuth, getPasteById);
app.patch('/:id', authUser, updatePaste);
app.get('/:id/export', optionalAuth, exportPaste);
app.get("/:id/summary", optionalAuth, summarizePaste);
app.post("/:id/favourite", authUser, favouritePaste);
app.post("/:id/unfavourite", authUser, unfavouritePaste);
app.get("/:id/favourite-status", optionalAuth, getFavouritePaste);


export default app;
