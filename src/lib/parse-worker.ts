// Runs the spreadsheet/PDF parser off the main thread (see parse.ts).
import { parentPort, workerData } from 'node:worker_threads';
import { FileFormatError, readWorkbook } from './sheet.js';

const { fileName, buf } = workerData as { fileName: string; buf: Uint8Array };
readWorkbook(fileName, buf).then(
  (wb) => parentPort!.postMessage({ ok: true, wb }),
  (err: unknown) =>
    parentPort!.postMessage({ ok: false, friendly: err instanceof FileFormatError, message: err instanceof Error ? err.message : String(err) }),
);
