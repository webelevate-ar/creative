/**
 * Parses uploaded files in a worker thread so a large or malicious file cannot block other users
 * (event loop) or exhaust the server's memory. At most MAX_CONCURRENT parses run at once.
 * Set PARSE_IN_WORKER=0 to parse in-process (tests).
 */
import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FileFormatError, readWorkbook, type Workbook } from './sheet.js';

const MAX_CONCURRENT = 2;
const TIMEOUT_MS = 30_000;
const WORKER_HEAP_MB = 768;

const isTs = import.meta.url.endsWith('.ts');
const workerUrl = new URL(isTs ? './parse-worker-dev.mjs' : './parse-worker.js', import.meta.url);

let running = 0;
const queue: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

function inWorker(fileName: string, buf: Uint8Array): Promise<Workbook> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { fileName, buf },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
    });
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new FileFormatError('El archivo tardó demasiado en procesarse. Probá con una versión en Excel o dividila en partes.'))), TIMEOUT_MS);
    worker.once('message', (m: { ok: true; wb: Workbook } | { ok: false; friendly: boolean; message: string }) =>
      done(() => (m.ok ? resolve(m.wb) : reject(m.friendly ? new FileFormatError(m.message) : new Error(m.message)))),
    );
    worker.once('error', (err: Error & { code?: string }) =>
      done(() => reject(err.code === 'ERR_WORKER_OUT_OF_MEMORY' ? new FileFormatError('El archivo es demasiado grande para procesarlo. Dividilo en partes o escribinos.') : err)),
    );
    worker.once('exit', (code) => done(() => reject(new Error(`parse worker exited with code ${code}`))));
  });
}

export function parseFile(fileName: string, buf: Uint8Array): Promise<Workbook> {
  if (process.env.PARSE_IN_WORKER === '0' || !existsSync(fileURLToPath(workerUrl))) return readWorkbook(fileName, buf);
  return slot(() => inWorker(fileName, buf));
}
