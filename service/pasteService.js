import Paste from "../models/TextPaste.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
import { summarizeText } from "../utils/azureSummary.js";
import { marked } from "marked";
export class PasteService {
    generateId(length = 6) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    async createPaste(data, user) {
        const { title, content, password, expiredAt, slug, exposure } = data;

        if (slug) {
            const exists = await Paste.get(slug);
            if (exists) throw new Error("Slug already in use.");
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
        let id = this.generateId(6);
        while (await Paste.get(id)) {
            id = this.generateId(6);
        }

        let expiresUnix;

        if (expiredAt) {
            const d = new Date(expiredAt);
            if (!isNaN(d.getTime())) {
                expiresUnix = Math.floor(d.getTime() / 1000);
            }
        }

        const item = {
            slug: slug || id,
            title,
            content,
            exposure: exposure || "public",
            views: 0,
        };

        if (user?.user_id) item.authorId = user.user_id;
        if (hashedPassword) item.hashedPassword = hashedPassword;
        if (expiresUnix !== undefined) item.expiredAt = expiresUnix;

        return await Paste.create(item);
    }

    async getPublicPastes(sortBy = "newest") {
        let pastes = await Paste.scan("exposure")
            .eq("public")
            .exec();
        // pastes = pastes.filter(p => !p.expiredAt || p.expiredAt > now);
        // console.log("Public pastes fetched:", pastes.length,);
        // SORT
        if (sortBy === "views") {
            pastes.sort((a, b) => (b.views || 0) - (a.views || 0));
        }
        else if (sortBy === "bookmark") {
            pastes.sort((a, b) => (b.bookmarks || 0) - (a.bookmarks || 0));
        }
        else { // newest (default)
            pastes.sort((a, b) => {
                const ad = new Date(a.createdAt || 0).getTime();
                const bd = new Date(b.createdAt || 0).getTime();
                return bd - ad;
            });
        }
        console.log("Public pastes sorted.");

        return pastes;
    }

    checkAccess(paste, user, password) {
        if (paste.exposure === "private") {
            if (!user || paste.authorId !== user.user_id)
                throw new Error("AccessDenied");
        }

        if (paste.exposure === "password_protected") {
            if (!paste.hashedPassword) throw new Error("WrongPassword");
            if (!bcrypt.compareSync(password || "", paste.hashedPassword))
                throw new Error("WrongPassword");
        }
    }

    async getPasteById(id, user, password) {
        const paste = await Paste.get(id);
        if (!paste) throw new Error("NotFound");

        const now = Math.floor(Date.now() / 1000);
        if (paste.expiredAt && paste.expiredAt <= now) throw new Error("NotFound");

        this.checkAccess(paste, user, password);
        return await Paste.update(
            { slug: id },
            { views: (paste.views || 0) + 1 }
        );
    }

    async updatePaste(id, data, user) {
        const paste = await Paste.get(id);
        if (!paste) throw new Error("NotFound");
        if (!user || user.user_id !== paste.authorId) throw new Error("AccessDenied");

        const updateData = {};

        if (data.title !== undefined) updateData.title = data.title;
        if (data.content !== undefined) updateData.content = data.content;

        if (data.expiredAt !== undefined) {
            if (data.expiredAt) {
                const d = new Date(data.expiredAt);
                if (!isNaN(d.getTime())) {
                    updateData.expiredAt = Math.floor(d.getTime() / 1000);
                }
            } else {
                updateData.expiredAt = undefined;
            }
        }

        return await Paste.update({ slug: id }, updateData);
    }

    async exportPaste(id, format) {
        const paste = await Paste.get(id);
        if (!paste) throw new Error("NotFound");

        if (format === "raw" || format === "markdown") {
            return {
                type: "raw",
                filename: `${paste.slug}.md`,
                content: paste.content,
            };
        }
        console.log("Exporting paste:", paste.content);
        const render = marked.parse(paste.content || "");
        console.log("Rendered content for export.", render);
        if (format === "png") {
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();

            const html = `
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1, h2, h3, h4 {
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    p {
                        margin-bottom: 8px;
                    }
                    pre, code {
                        background: #f4f4f4;
                        padding: 10px;
                        border-radius: 5px;
                        display: block;
                        white-space: pre-wrap;
                        font-family: monospace;
                    }
                    strong { font-weight: bold; }
                    em { font-style: italic; }
                    li { margin-bottom: 4px; }
                </style>
            </head>
            <body>${render}</body>
        </html>
    `;

            await page.setContent(html, { waitUntil: "networkidle0" });

            const buffer = await page.screenshot({ fullPage: true });

            await browser.close();

            return { type: "png", filename: `${paste.slug}.png`, content: buffer };
        }

        if (format === "pdf") {
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();

            const html = `
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1, h2, h3, h4 {
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    p {
                        margin-bottom: 8px;
                    }
                    pre, code {
                        background: #f4f4f4;
                        padding: 10px;
                        border-radius: 5px;
                        display: block;
                        white-space: pre-wrap;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>${render}</body>
        </html>
    `;

            await page.setContent(html, { waitUntil: "networkidle0" });

            const pdf = await page.pdf({ format: "A4" });

            await browser.close();

            return {
                type: "pdf",
                filename: `${paste.slug}.pdf`,
                content: pdf
            };
        }

        throw new Error("InvalidFormat");
    }

    async summarizePaste(id, user, password) {
        const paste = await Paste.get(id);
        // console.log(paste);
        if (!paste) throw new Error("NotFound");

        //this.checkAccess(paste, user, password);
        const summary = await summarizeText(paste.content);

        return { title: paste.title, summary };
    }

    async searchPastes(query) {
        const q = query.toLowerCase();

        const pastes = await Paste.scan("exposure").eq("public").exec();
        const filtered = pastes.filter(p =>
            p.content?.toLowerCase().includes(q) ||
            p.title?.toLowerCase().includes(q)
        );

        return filtered.map(p => ({
            slug: p.slug,
            title: p.title,
            snippet: p.content.substring(0, 150) + "...",  // snippet nhỏ
            views: p.views,
            authorId: p.authorId,
            exposure: p.exposure
        }));
    }

}
