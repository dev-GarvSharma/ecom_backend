import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
const dir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads");
fs.mkdirSync(dir, { recursive: true });
const types = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const uploadImages = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (_r, f, cb) =>
      cb(
        null,
        crypto.randomUUID() + path.extname(f.originalname).toLowerCase(),
      ),
  }),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_MB || 15) * 1048576,
    files: 8,
  },
  fileFilter: (_r, f, cb) =>
    cb(
      types.has(f.mimetype) ? null : new Error("Unsupported image type."),
      types.has(f.mimetype),
    ),
});
