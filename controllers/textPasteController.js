import { PasteService } from "../service/pasteService.js";
const pasteService = new PasteService();
export const createPaste = async (req, res) => {
    try {
        const paste = await pasteService.createPaste(req.body, req.user);
        res.status(201).json(paste);
    } catch (err) {
        const code = err.message === "Slug already in use." ? 409 : 400;
        res.status(code).json({ error: err.message });
    }
};

export const getPublicPastes = async (req, res) => {
    try {
        console.log("Fetching public pastes");
        const pastes = await pasteService.getPublicPastes();
        console.log(pastes);
        res.json(pastes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getPasteById = async (req, res) => {
    try {
        const paste = await pasteService.getPasteById(
            req.params.id,
            req.user,
            req.query.password
        );
        res.json(paste);
    } catch (err) {
        if (err.message === "NotFound") return res.status(404).json({ error: "Paste not found" });
        if (err.message.startsWith("AccessDenied")) return res.status(403).json({ error: "Access denied" });
        if (err.message.startsWith("WrongPassword")) return res.status(403).json({ error: "Password incorrect" });
        res.status(500).json({ error: err.message });
    }
};

export const updatePaste = async (req, res) => {
    try {
        const paste = await pasteService.updatePaste(req.params.id, req.body, req.user);
        res.json({ message: "Paste updated", paste });
    } catch (err) {
        if (err.message === "NotFound") return res.status(404).json({ error: "Paste not found" });
        if (err.message === "AccessDenied") return res.status(403).json({ error: "Not owner" });
        res.status(500).json({ error: err.message });
    }
};

export const exportPaste = async (req, res) => {
    try {
        const file = await pasteService.exportPaste(req.params.id, req.query.format);

        res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);

        if (file.type === "raw") {
            res.setHeader("Content-Type", "text/markdown");
            return res.send(file.content);
        }
        if (file.type === "png") res.setHeader("Content-Type", "image/png");
        if (file.type === "pdf") res.setHeader("Content-Type", "application/pdf");

        res.send(file.content);
    } catch (err) {
        if (err.message === "NotFound") return res.status(404).json({ error: "Paste not found" });
        res.status(500).json({ error: err.message });
    }
};

export const summarizePaste = async (req, res) => {
    try {
        // console.log("Summarizing paste:", req.params.id);
        const result = await pasteService.summarizePaste(
            req.params.id,
            req.user,
            req.query.password
        );

        res.json(result);
    } catch (err) {
        if (err.message === "NotFound") return res.status(404).json({ error: "Paste not found" });
        if (err.message.startsWith("AccessDenied")) return res.status(403).json({ error: "Access denied" });
        if (err.message.startsWith("WrongPassword")) return res.status(403).json({ error: "Password incorrect" });
        res.status(500).json({ error: "Failed summarizing" });
    }
};

export const searchPastes = async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase() || "";
        console.log("Searching pastes for query:", query);
        if (!query) return res.status(400).json({ error: "Missing search query" });
        console.log("Searching pastes for query:", query);
        const results = await pasteService.searchPastes(query);
        res.json(results);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ error: "Search failed" });
    }
};
