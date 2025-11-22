// backend/controllers/imageController.js
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

// KHỞI TẠO S3 – QUAN TRỌNG NHẤT!
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export const uploadImage = async (req, res) => {
  try {
    console.log("Received upload request:", req.body);

    const { slug, albumId, albumTitle } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image file received" });
    }

    // Tạo key theo album
    let key;
    if (albumId) {
      const cleanAlbumId = albumId.trim().replace(/[^a-zA-Z0-9-]/g, "-");
      const cleanSlug = (slug?.trim() || `img-${uuidv4().slice(0, 8)}`)
        .replace(/[^a-zA-Z0-9-]/g, "-");
      key = `albums/${cleanAlbumId}/${cleanSlug}.png`;
    } else {
      const cleanSlug = (slug?.trim() || `draw-${Date.now()}`)
        .replace(/[^a-zA-Z0-9-]/g, "-");
      key = `i/${cleanSlug}.png`;
    }

    // Upload lên S3
    await s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: "image/png",
    }).promise();

    const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-southeast-1"}.amazonaws.com/${key}`;
    const shareLink = albumId
      ? `https://gizmo.app/album/${albumId}`
      : `https://gizmo.app/i/${slug || key.split("/").pop().replace(".png", "")}`;

    console.log("Upload thành công:", key);

    res.json({
      success: true,
      imageUrl,
      shareLink,
      key,
      albumId,
      albumTitle: albumTitle || "My Album",
    });
  } catch (err) {
    console.error("S3 Upload Error:", err);
    res.status(500).json({
      message: "Upload failed",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};