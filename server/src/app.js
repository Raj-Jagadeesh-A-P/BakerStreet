import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { MulterError } from 'multer';
import { config, isProd } from './config.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { AppError } from './middleware/errors.js';
import { MESSAGES } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(config.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

// In production the same process serves the built React app, making the whole
// platform a single deployable unit.
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(uploadDir, { maxAge: '1d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/auth', apiLimiter, authRoutes);
  app.use('/api', eventRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (req, _res, next) => next(new AppError(404, MESSAGES.notFound)));

  if (isProd() && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    } else {
      console.warn(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status} ${err.message}`);
    }
    if (res.headersSent) return;
    const isMulter = err instanceof MulterError;
    if (isMulter || /only images/iu.test(err.message)) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File is too large (max ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB).`
          : err.message;
      return res.status(400).json({ error: msg });
    }
    res.status(status).json({ error: status >= 500 ? MESSAGES.generic : err.message });
  });

  return app;
}