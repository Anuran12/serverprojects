import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads", "tasks");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".ppt",
  ".pptx",
  ".rtf",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".zip",
  ".7z"
]);

function isAllowedFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_EXT.has(ext)) return true;
  const mt = (file.mimetype || "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  if (
    mt.includes("pdf") ||
    mt.includes("word") ||
    mt.includes("excel") ||
    mt.includes("spreadsheet") ||
    mt.includes("officedocument")
  ) {
    return true;
  }
  return false;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || "";
    cb(null, `${randomUUID()}${ext}`);
  }
});

export const taskFileUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file)) cb(null, true);
    else cb(new Error("File type not allowed"));
  }
});

export function safeUnlink(filename) {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return;
  }
  const full = path.join(UPLOAD_DIR, filename);
  fs.promises.unlink(full).catch(() => {});
}
