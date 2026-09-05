import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';

const uploadDir = path.resolve(config.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const ALLOWED = /\.(png|jpe?g|webp|pdf)$/i;

export const uploadSingle = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.originalname)) {
      return cb(new Error('Only images (png, jpg, webp) and PDF files are allowed.'));
    }
    cb(null, true);
  },
}).single('attachment');