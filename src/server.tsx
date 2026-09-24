import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { createMailer } from './lib/mailer.js';
import { createApp } from './app.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const app = createApp({ db, config, mailer: createMailer(config) });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Remarcá listening on http://localhost:${info.port} (${config.env})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
