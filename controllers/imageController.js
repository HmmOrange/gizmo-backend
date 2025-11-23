// backend/controllers/imageController.js
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import Album from "../models/Album.js";
import { ImageService } from "../service/imageService.js";

// KHỞI TẠO S3 – QUAN TRỌNG NHẤT!
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export const uploadImage = async (req, res) => {
  try {
    console.log("Received upload request:", req.body);

    const { slug, albumId, albumTitle, albumExposure } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image file received" });
    }

    const imageService = new ImageService();
    // Determine final slug atomically before uploading so S3 key matches DB
    const isCustom = req.body?.isCustomSlug === "true" || req.body?.isCustomSlug === true;
    let finalSlug;
    try {
      finalSlug = await imageService.generateUniqueSlug(slug, isCustom);
    } catch (slugErr) {
      if (slugErr.code === "SLUG_TAKEN") {
        return res.status(409).json({ message: "Image slug already in use", slugTaken: true });
      }
      console.error("Slug generation error:", slugErr);
      return res.status(500).json({ message: "Slug generation failed", error: slugErr.message });
    }

    // Build S3 key: always store under `images/` root (no album subfolders)
    const cleanSlug = (finalSlug || `img-${uuidv4().slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, "-");
    const key = `images/${cleanSlug}.png`;

    // Upload lên S3
    try {
      console.log("S3 upload: bucket=", process.env.S3_BUCKET_NAME, "key=", key, "size=", file.size, "mimetype=", file.mimetype);
      const uploadResult = await s3.upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "image/png",
      }).promise();
      console.log("S3 upload result:", uploadResult);
    } catch (s3Err) {
      console.error("S3 upload failed:", s3Err);
      return res.status(502).json({ message: "S3 upload failed", error: s3Err.message || s3Err });
    }

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-southeast-1"}.amazonaws.com/${key}`;
    const shareLink = (albumId && albumId !== "images")
      ? `https://gizmo.app/album/${albumId}`
      : `https://gizmo.app/i/${slug || key.split("/").pop().replace(".png", "")}`;

    console.log("Upload thành công:", key);

    // Save metadata into MongoDB
    try {
      const imageService = new ImageService();

      // If an albumId was provided and it's not the special 'images' bucket,
      // ensure an Album document exists (create if missing). We will NOT change S3 key based on album.
      const normalizedAlbumId = albumId?.trim();
      let finalAlbumId = normalizedAlbumId && normalizedAlbumId !== "images" ? normalizedAlbumId : null;
      let albumObjectId = null;
      if (finalAlbumId) {
        let albumDoc = await Album.findOne({ slug: finalAlbumId });
        if (!albumDoc) {
          // Create the album even if the uploader is not authenticated.
          // Use provided albumExposure when available; otherwise default to private.
          const requestedExposure = (req.body.albumExposure || "private").trim();
          const allowed = new Set(["public", "unlisted", "private"]);
          const finalExposure = allowed.has(requestedExposure) ? requestedExposure : "private";
          albumDoc = await Album.create({
            name: albumTitle || finalAlbumId,
            slug: finalAlbumId,
            description: "",
            authorId: req.user?.id || null,
            exposure: finalExposure,
          });
        }
        albumObjectId = albumDoc._id;
      }

      const imageType = file.mimetype?.split("/")?.[1] || "png";

      // Store albumId in the image metadata if provided; file still uploaded under `images/`
      const saved = await imageService.createImage(
        {
          caption: req.body.caption || "",
          slug: finalSlug,
          imageUrl,
          imageSize: file.size,
          imageType,
          exposure: req.body.exposure || "public",
          password: req.body.password || undefined,
          albumId: albumObjectId || null,
          isCustomSlug: isCustom,
        },
        req.user?.id || null
      );

      // If an album was specified, add a reference to this image in the album document
      if (albumObjectId) {
        try {
          await Album.findByIdAndUpdate(albumObjectId, { $push: { images: saved._id } }, { upsert: false });
        } catch (pushErr) {
          console.error("Failed to push image into album.images:", pushErr);
        }
      }

      return res.json({
        success: true,
        image: saved,
        imageUrl,
        shareLink,
        key,
        albumId: finalAlbumId,
        albumTitle: albumTitle || "My Album",
      });
    } catch (dbErr) {
      console.error("DB Save Error:", dbErr);
      // If DB save failed due to slug conflict, remove uploaded S3 object to avoid orphaned file
      try {
        await s3.deleteObject({ Bucket: process.env.S3_BUCKET_NAME, Key: key }).promise();
        console.log("Deleted S3 object due to DB error:", key);
      } catch (delErr) {
        console.error("Failed to delete S3 object after DB error:", delErr);
      }

      // If slug taken, return 409 so client can notify user
      if (dbErr.code === "SLUG_TAKEN" || (dbErr.code && String(dbErr.code).includes("E11000")) || dbErr.message?.includes("Slug already in use")) {
        return res.status(409).json({ message: "Image slug already in use", slugTaken: true });
      }

      return res.status(500).json({ message: "Failed to save image metadata", error: dbErr.message });
    }
  } catch (err) {
    console.error("S3 Upload Error:", err);
    res.status(500).json({
      message: "Upload failed",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

export const checkImageSlug = async (req, res) => {
  try {
    const slug = (req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ available: false, message: "Missing slug" });
    const Image = (await import("../models/Image.js")).default;
    const exists = await Image.findOne({ slug });
    return res.json({ available: !exists });
  } catch (err) {
    console.error("checkImageSlug error:", err);
    res.status(500).json({ available: false, message: "Server error" });
  }
};

export const checkImageSlugsBulk = async (req, res) => {
  try {
    const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs.map(s => (s || "").trim()).filter(Boolean) : [];
    if (!slugs.length) return res.status(400).json({ message: "Missing slugs array" });
    const Image = (await import("../models/Image.js")).default;
    const existing = await Image.find({ slug: { $in: slugs } }).select("slug").lean();
    const existingSet = new Set(existing.map(e => e.slug));
    const results = {};
    for (const s of slugs) results[s] = !existingSet.has(s);
    return res.json({ results });
  } catch (err) {
    console.error("checkImageSlugsBulk error:", err);
    res.status(500).json({ message: "Server error" });
  }
};