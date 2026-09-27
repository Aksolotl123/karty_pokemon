// Rozpoznawanie tekstu (Tesseract.js) — działa w całości na telefonie.
// Pliki silnika i słownika są hostowane razem z aplikacją (public/tesseract),
// więc po pierwszym uruchomieniu działa też offline.
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { REGIONS, regionRect, type Rect } from './geometry';
import { prepareForOcr, sourceSize, type Source } from './image';
import { extractName, parseCollectorNumber, type CollectorNumber } from './text';

export interface OcrResult {
  name: string | null;
  number: CollectorNumber | null;
  rawName: string;
  rawNumber: string;
}

let workerPromise: Promise<Worker> | null = null;

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}tesseract/${path}`, location.href).href;
}

export function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        workerPath: assetUrl('worker.min.js'),
        corePath: assetUrl('core/'),
        langPath: assetUrl('lang'),
        logger: (m) => { if (m.status.startsWith('loading')) onProgress?.(m.progress); },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
      return worker;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

interface Line { text: string; height: number }

async function readRegion(worker: Worker, src: Source, r: Rect): Promise<{ text: string; lines: Line[] }> {
  if (r.w < 4 || r.h < 4) return { text: '', lines: [] };
  const canvas = prepareForOcr(src, r);
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const lines: Line[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    if (l.confidence >= 30) lines.push({ text: l.text.trim(), height: l.bbox.y1 - l.bbox.y0 });
  }
  return { text: data.text ?? '', lines };
}

/** Odczytuje nazwę (górny pasek) i numer (dolny pasek) karty leżącej w prostokącie `card`. */
export async function readCard(src: Source, card: Rect): Promise<OcrResult> {
  const worker = await getWorker();
  const { w, h } = sourceSize(src);
  // Worker przetwarza zadania po kolei, więc nie ma zysku z równoległości.
  const numberPart = await readRegion(worker, src, regionRect(card, REGIONS.number, w, h));
  const namePart = await readRegion(worker, src, regionRect(card, REGIONS.name, w, h));
  return {
    name: extractName(namePart.lines),
    number: parseCollectorNumber(numberPart.text),
    rawName: namePart.text.trim(),
    rawNumber: numberPart.text.trim(),
  };
}
