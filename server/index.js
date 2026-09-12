import { createApp, DEFAULT_ORIGINS } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const { server } = createApp({ corsOrigins: corsOrigins.length ? corsOrigins : DEFAULT_ORIGINS });
server.listen(PORT, HOST, () => {
  console.log(`NPAT Arena server listening on http://${HOST}:${PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);