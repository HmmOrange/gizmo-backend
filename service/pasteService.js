// services/PasteService.js
import Paste from "../models/TextPaste.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";

export class PasteService {
  async createPaste(data, user) {
    const { title, content, password, expiredAt, slug, exposure } = data;

    if (slug) {
      const exists = await Paste.findOne({ slug });
      if (exists) throw new Error("Slug already in use.");
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const id = uuidv4();

    const paste = new Paste({
      slug: slug || id,
      title,
      content,
      hashedPassword,
      exposure: exposure || "public",
      expiredAt: expiredAt ? new Date(expiredAt) : null,
      date_created: new Date(),
      authorId: user?.user_id || null,
    });
    console.log("Created paste:", paste);
    await paste.save();
    return paste;
  }

  async getPublicPastes() {
    const now = new Date();
    return await Paste.find({
      exposure: "public",
      $or: [{ expiredAt: null }, { expiredAt: { $gt: now } }],
      date_deleted: null,
    }).sort({ date_created: -1 });
  }

  checkAccess(paste, user, password) {
    if (paste.exposure === "private") {
      if (!user || paste.authorId !== user.user_id)
        throw new Error("AccessDenied: You cannot view this paste.");
    }

    if (paste.exposure === "password_protected") {
      if (!bcrypt.compareSync(password || "", paste.hashedPassword))
        throw new Error("WrongPassword: Password incorrect.");
    }
  }

  async getPasteById(id, user, password) {
    const now = new Date();
    const paste = await Paste.findOne({
      slug: id,
      $or: [{ expiredAt: null }, { expiredAt: { $gt: now } }],
    });

    if (!paste) throw new Error("NotFound");
    this.checkAccess(paste, user, password);

    paste.views++;
    await paste.save();
    console.log(paste, user?.user_id)
    return paste;
  }

  async updatePaste(id, data, user) {
    const paste = await Paste.findOne({ slug: id });
    if (!paste) throw new Error("NotFound");

    if (!user || user.user_id !== paste.authorId)
      throw new Error("AccessDenied");

    if (data.title !== undefined) paste.title = data.title;
    if (data.content !== undefined) paste.content = data.content;
    if (data.expiredAt !== undefined)
      paste.expiredAt = data.expiredAt ? new Date(data.expiredAt) : null;

    await paste.save();
    return paste;
  }
  async exportPaste(id, format) {
    const paste = await Paste.findOne({ slug: id });
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
          const buffer = Buffer.concat(chunks);
          resolve({
            type: "pdf",
            filename: `${paste.slug}.pdf`,
            content: buffer,
          });
        });
        doc.font("Courier").fontSize(12).text(paste.content);
        doc.end();
      });
    }

    throw new Error("InvalidFormat");
  }

  async summarizePaste(id, user, password) {
    // const paste = await Paste.findOne({ slug: id });
    // if (!paste) throw new Error("NotFound");

    // this.checkAccess(paste, user, password);

    // const summary = await summarizeText(paste.content);

    // return { title: paste.title, summary };
  }
}
