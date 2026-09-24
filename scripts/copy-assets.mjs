// Copies non-TS assets (SQL migrations, static files) next to the compiled output.
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/db', { recursive: true });
cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
cpSync('src/public', 'dist/public', { recursive: true });
console.log('assets copied');
