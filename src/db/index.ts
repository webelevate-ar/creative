import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCode } from '../lib/match.js';

export type DB = Database.Database;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}

/** Migrations that need application code. They run after the SQL files, once each. */
const CODE_MIGRATIONS: { name: string; run: (db: DB) => void }[] = [
  {
    // Code keys became exact (punctuation kept, docs/20 §8). Links saved with the old loose key keep it:
    // it still matches codes without punctuation and is only a review suggestion otherwise.
    name: '003_exact_code_keys',
    run: (db) => {
      db.function('exact_code', { deterministic: true }, (v: unknown) => (v == null ? null : normalizeCode(String(v))));
      db.exec(`UPDATE products SET code_norm = exact_code(code), supplier_code_norm = exact_code(supplier_code);
               UPDATE import_rows SET code_norm = exact_code(raw_code);`);
    },
  },
];

export function migrate(db: DB): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').pluck().all() as string[]);
  const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(f, new Date().toISOString());
    })();
  }
  for (const m of CODE_MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.transaction(() => {
      m.run(db);
      record.run(m.name, new Date().toISOString());
    })();
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
