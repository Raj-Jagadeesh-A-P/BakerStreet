import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`BakerStreet API listening on http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use. Another process is bound to it.\n` +
        `Find it with:  ss -ltnp | grep :${config.port}\n` +
        `Then stop it, or start BakerStreet on another port:  PORT=4001 npm run server`,
    );
  } else {
    console.error('Server failed to start:', err);
  }
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));