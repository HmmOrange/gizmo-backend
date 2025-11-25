import Paste from "../models/TextPaste.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
import { summarizeText } from "../utils/azureSummary.js";
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

    async getPublicPastes() {
        const now = Math.floor(Date.now() / 1000);

        return await Paste.scan("exposure")
            .eq("public")
            // .filter("expiredAt")
            // .ge(now)
            // .sort("descending")
            .exec();
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

        if (format === "png") {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(
                `<pre style='font-family: monospace; font-size: 16px;'>${paste.content
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")}</pre>`
            );
            const buffer = await page.screenshot({ fullPage: true });
            await browser.close();

            return { type: "png", filename: `${paste.slug}.png`, content: buffer };
        }

        if (format === "pdf") {
            const doc = new PDFDocument();
            let chunks = [];

            doc.on("data", (chunk) => chunks.push(chunk));
            return new Promise((resolve) => {
                doc.on("end", () => {
                    resolve({
                        type: "pdf",
                        filename: `${paste.slug}.pdf`,
                        content: Buffer.concat(chunks),
                    });
                });
                doc.font("Courier").fontSize(12).text(paste.content);
                doc.end();
            });
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

    async getPastesByUser(userId) {
        if (!userId) return [];
        try {
            console.log('getPastesByUser querying for userId:', userId);
            // Use scan as fallback since query on GSI might not work reliably
            let pastes = await Paste.scan('authorId').eq(userId).exec();
            console.log('Scan result:', pastes ? pastes.length : 0, 'pastes');
            if (!pastes || pastes.length === 0) {
                console.log('No pastes found, trying query method');
                pastes = await Paste.query('authorId').eq(userId).exec();
                console.log('Query result:', pastes ? pastes.length : 0, 'pastes');
            }
            return (pastes || []).map(p => ({
                slug: p.slug,
                title: p.title,
                snippet: (p.content || '').substring(0, 150) + (p.content && p.content.length > 150 ? '...' : ''),
                views: p.views || 0,
                bookmarks: p.bookmarks || 0,
                authorId: p.authorId,
                exposure: p.exposure,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt
            }));
        } catch (err) {
            console.error('getPastesByUser error:', err.message, err);
            return [];
        }
    }

}
