// Development only: the worker thread does not inherit tsx's loader, so register it here
// and then load the TypeScript worker. Production runs the compiled parse-worker.js directly.
import { register } from 'tsx/esm/api';

register();
await import('./parse-worker.ts');
