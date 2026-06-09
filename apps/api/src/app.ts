import cors from 'cors';
import express from 'express';
import { auditRouter } from './routes/auditRoutes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', auditRouter);

  return app;
}
